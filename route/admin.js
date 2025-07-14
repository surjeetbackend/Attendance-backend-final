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
// GET employee by empId
router.get('/api/admin/user/:empId', async (req, res) => {
  try {
    const empId = req.params.empId;
    const user = await User.findOne({ empId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user); // must include photo field
  } catch (err) {
    res.status(500).json({ error: 'Error fetching user data' });
  }
});

// PUT update photo
router.put('/api/admin/user/:empId', async (req, res) => {
  try {
    const empId = req.params.empId;
    const { photo } = req.body;
    const user = await User.findOneAndUpdate({ empId }, { photo }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Photo updated', photo: user.photo });
  } catch (err) {
    res.status(500).json({ error: 'Error updating photo' });
  }
});


module.exports = router;
