const express = require('express');
const router = express.Router();
const Leave = require('../model/leave');
const User = require('../model/user');


router.post('/apply', async (req, res) => {
  try {
    const { empId, empName, startDate, endDate, reason } = req.body;

    if (!empId || !empName || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const employee = await User.findOne({ empId });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ error: 'End date cannot be before start date' });
    }

    const hireDate = new Date(employee.hireDate);
    const today = new Date();
    const sixMonthsPassed = today - hireDate >= 183 * 24 * 60 * 60 * 1000;

    const durationDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

    let paidDays = 0;
    let unpaidDays = durationDays;
    let leaveTypeSummary = 'unpaid';

    if (sixMonthsPassed) {
      const paidLeaveRemaining = Math.max(employee.paidLeave.total - employee.paidLeave.used, 0);
      paidDays = Math.min(durationDays, paidLeaveRemaining);
      unpaidDays = durationDays - paidDays;

      leaveTypeSummary =
        paidDays > 0 && unpaidDays > 0
          ? `partially paid (${paidDays} paid, ${unpaidDays} unpaid)`
          : paidDays > 0
          ? 'paid'
          : 'unpaid';
    }

    const newLeave = new Leave({
      employeeId: empId,
      employeeName: empName,
      startDate,
      endDate,
      reason,
      status: 'pending',
      approveBy: '',
      appliedAt: new Date(),
      leaveType: leaveTypeSummary,
      paidDays,
      unpaidDays
    });

    await newLeave.save();

    res.status(201).json({
      message: `Leave request submitted as ${leaveTypeSummary}.`,
      leave: newLeave
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to apply for leave.' });
  }
});


// Get leaves by employee code
router.get('/my/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await User.findOne({ empId: employeeId });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const leaves = await Leave.find({ employeeId: employee.empId }).sort({ appliedAt: -1 });

    const approvedLeaves = await Leave.find({
      employeeId: employee.empId,
      status: 'approved'
    });

    let usedPaidLeave = 0;

    for (const leave of approvedLeaves) {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      if (end >= start && leave.leaveType === 'paid') {
        const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        usedPaidLeave += duration;
      }
    }

    const hireDate = new Date(employee.hireDate);
    const today = new Date();
    const sixMonthsPassed = today - hireDate >= 183 * 24 * 60 * 60 * 1000;

    const totalPaidLeave = sixMonthsPassed ? (employee.paidLeave?.total || 0) : 0;
    const cappedUsedLeave = Math.min(usedPaidLeave, totalPaidLeave);
    const remainingPaidLeave = totalPaidLeave - cappedUsedLeave;

    res.json({
      leaves,
      paidLeave: {
        total: totalPaidLeave,
        used: cappedUsedLeave,
        remaining: remainingPaidLeave,
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch leave requests.' });
  }
});


// View all pending leaves
router.get('/pending', async (req, res) => {
  try {
    const leaves = await Leave.find({ status: 'pending' }).sort({ appliedAt: -1 });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending leaves.' });
  }
});


// Approve leave
router.patch('/:id/approve', async (req, res) => {
  try {
    const adminName = req.body.approveBy || req.body.admin_name;
    const { hrComment } = req.body;

    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ error: 'Leave not found' });

    if (leave.status === 'approved') {
      return res.status(400).json({ error: 'Leave already approved' });
    }

    await Leave.findByIdAndUpdate(req.params.id, {
      status: 'approved',
      approveBy: adminName,
      hrComment: hrComment || ''
    });

    const employee = await User.findOne({ empId: leave.employeeId });

    if (employee) {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      if (end >= start) {
        const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        if (leave.leaveType === 'paid') {
          employee.paidLeave.used += duration;
          await employee.save();
        }
      }
    }

    res.json({ message: 'Leave approved by ' + adminName });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve leave.' });
  }
});



// Reject leave
router.patch('/:id/reject', async (req, res) => {
  try {
    const { hrComment } = req.body||{};

    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ error: 'Leave not found' });

    await Leave.findByIdAndUpdate(req.params.id, {
      status: 'rejected',
      hrComment: hrComment || ''
    });

    res.json({ message: 'Leave rejected.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject leave.' });
  }
});




router.get('/all', async (req, res) => {
  try {
    const leaves = await Leave.find().sort({ appliedAt: -1 });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all leave records.' });
  }
});



router.get('/check/:employeeId', async (req, res) => {
  try {
    const { date } = req.query;

    const isOnLeave = await Leave.findOne({
      employeeId: req.params.employeeId,
      status: 'approved',
      startDate: { $lte: date },
      endDate: { $gte: date }
    });

    res.json({ onLeave: !!isOnLeave });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check leave status.' });
  }
});

// router.get('/eligibility/:empId', async (req, res) => {
//   try {
//     const { empId } = req.params;
//     const { startDate, endDate } = req.query;

//     const employee = await User.findOne({ empId });
//     if (!employee) return res.status(404).json({ error: 'Employee not found' });

//     const hireDate = new Date(employee.hireDate);
//     const today = new Date();
//     const sixMonthsPassed = today - hireDate >= 183 * 24 * 60 * 60 * 1000;

//     const duration = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

//     let paidDays = 0;
//     let unpaidDays = duration;
//     let leaveType = 'unpaid';

//     if (sixMonthsPassed) {
//       const remaining = employee.paidLeave.total - employee.paidLeave.used;
//       paidDays = Math.min(duration, Math.max(remaining, 0));
//       unpaidDays = duration - paidDays;

//       leaveType = paidDays > 0 && unpaidDays > 0
//         ? `partially paid (${paidDays} paid, ${unpaidDays} unpaid)`
//         : paidDays > 0
//         ? 'paid'
//         : 'unpaid';
//     }

//     res.json({
//       eligible: sixMonthsPassed,
//       paidDays,
//       unpaidDays,
//       leaveType,
//       note: sixMonthsPassed ? `You will get: ${leaveType}` : 'You are not eligible for paid leave (less than 6 months)'
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Something went wrong' });
//   }
// });
router.patch('/:id/remark', async (req, res) => {
  try {
    const { id } = req.params;
    const { hrComment } = req.body;

    if (!hrComment || hrComment.trim() === '') {
      return res.status(400).json({ error: 'Remark is required' });
    }

    const leave = await Leave.findByIdAndUpdate(
      id,
      { hrComment: hrComment.trim() },
      { new: true }
    );

    if (!leave) {
      return res.status(404).json({ error: 'Leave not found' });
    }

    res.json({ message: 'Remark updated', leave });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update remark.' });
  }
});



module.exports = router;
