const express = require('express');
const router = express.Router();
const Leave = require('../model/leave');
const User = require('../model/user');
const Holiday = require('../model/holidays');


//apply leave
router.post('/apply', async (req, res) => {
  try {
    const { empId, empName, startDate, endDate, reason, leaveType } = req.body;

    if (!empId || !empName || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const employee = await User.findOne({ empId });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return res.status(400).json({ error: 'End date cannot be before start date' });
    }

    const overlappingLeave = await Leave.findOne({
      employeeId: empId,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: end },
      endDate: { $gte: start }
    });

    if (overlappingLeave) {
      return res.status(400).json({ error: 'Leave already exists for these dates' });
    }

    const durationDays =
      Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    let paidDays = 0;
    let unpaidDays = durationDays;
    let leaveTypeSummary = 'unpaid';

    if (leaveType === 'optional_leave') {
      if (durationDays !== 1) {
        return res.status(400).json({ error: 'Optional leave can only be for 1 day' });
      }

      const dayStart = new Date(start);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(start);
      dayEnd.setHours(23, 59, 59, 999);

      const optionalHoliday = await Holiday.findOne({
        date: { $gte: dayStart, $lte: dayEnd },
        category: 'optional'
      });

      if (!optionalHoliday) {
        return res.status(400).json({ error: 'Selected date is not an optional holiday' });
      }

      const yearStart = new Date(start.getFullYear(), 0, 1);
      const yearEnd = new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);

      const usedOptionalLeaves = await Leave.countDocuments({
        employeeId: empId,
        leaveType: 'optional_leave',
        status: { $in: ['pending', 'approved'] },
        startDate: { $gte: yearStart, $lte: yearEnd }
      });

      if (usedOptionalLeaves >= 2) {
        return res.status(400).json({ error: 'Only 2 optional leaves are allowed in a year' });
      }

      paidDays = 1;
      unpaidDays = 0;
      leaveTypeSummary = 'optional_leave';
    } else {
      const hireDate = new Date(employee.hireDate);
      const today = new Date();
      const sixMonthsPassed = today - hireDate >= 183 * 24 * 60 * 60 * 1000;

      if (sixMonthsPassed) {
        const paidLeaveRemaining = Math.max(
          (employee.paidLeave?.total || 0) - (employee.paidLeave?.used || 0),
          0
        );

        paidDays = Math.min(durationDays, paidLeaveRemaining);
        unpaidDays = durationDays - paidDays;

        leaveTypeSummary =
          paidDays > 0 && unpaidDays > 0
            ? 'partially paid'
            : paidDays > 0
            ? 'paid'
            : 'unpaid';
      }
    }

    const newLeave = new Leave({
      employeeId: empId,
      employeeName: empName,
      startDate: start,
      endDate: end,
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
    let usedOptionalLeave = 0;

    for (const leave of approvedLeaves) {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);

      if (end >= start) {
        const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        if (leave.leaveType === 'paid') {
          usedPaidLeave += duration;
        }

        if (leave.leaveType === 'optional_leave') {
          usedOptionalLeave += 1;
        }
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
      },
      optionalLeave: {
        total: 2,
        used: usedOptionalLeave,
        remaining: Math.max(2 - usedOptionalLeave, 0)
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
    const { hrComment } = req.body || {};

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
