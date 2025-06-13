const express = require('express');
const Employee = require('../model/user');
const Attendance = require('../model/Attendance');
const router = express.Router();

// ✅ Public: Get Employees
router.get('/user', async(req, res) => {
    try {
        const employees = await Employee.find({});
        res.json(employees);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ Public: Get Attendance Records
router.get('/attendances', async(req, res) => {
    try {
        const records = await Attendance.find({});
        res.json(records);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;