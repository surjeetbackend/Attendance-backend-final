// leaveRoutes.js
const express = require('express');
const router = express.Router();
const Leave = require('../model/leave');

// 1. Apply for Leave
router.post('/apply', async(req, res) => {
    try {
        const { employeeId, employeeName, startDate, endDate, reason } = req.body;

        const newLeave = new Leave({
            employeeId,
            employeeName,
            startDate,
            endDate,
            reason,
            status: 'pending',
            appliedAt: new Date()
        });

        await newLeave.save();
        res.status(201).json({ message: 'Leave request submitted.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to apply for leave.' });
    }
});

// 2. View Own Leave Requests
router.get('/my/:employeeId', async(req, res) => {
    try {
        const leaves = await Leave.find({ employeeId: req.params.employeeId }).sort({ appliedAt: -1 });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ error: 'Unable to fetch leave requests.' });
    }
});

// 3. Get All Pending Leaves (Admin)
router.get('/pending', async(req, res) => {
    try {
        const leaves = await Leave.find({ status: 'pending' }).sort({ appliedAt: -1 });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending leaves.' });
    }
});

// 4. Approve Leave (Admin)
router.patch('/:id/approve', async(req, res) => {
    try {
        await Leave.findByIdAndUpdate(req.params.id, { status: 'approved' });
        res.json({ message: 'Leave approved.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to approve leave.' });
    }
});

// 5. Reject Leave (Admin)
router.patch('/:id/reject', async(req, res) => {
    try {
        await Leave.findByIdAndUpdate(req.params.id, { status: 'rejected' });
        res.json({ message: 'Leave rejected.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reject leave.' });
    }
});

// 6. Get All Leaves (for Admin report)
router.get('/all', async(req, res) => {
    try {
        const leaves = await Leave.find().sort({ appliedAt: -1 });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch all leave records.' });
    }
});

// 7. Check Leave for a Specific Date
router.get('/check/:employeeId', async(req, res) => {
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

module.exports = router;