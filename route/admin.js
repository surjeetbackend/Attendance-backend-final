const express = require('express');
const Employee = require('../model/user');
const Attendance = require('../model/Attendance');
const router = express.Router();

// ✅ GET Employees (optimized with lean & selected fields)
router.get('/user', async (req, res) => {
  try {
    const employees = await Employee.find({})
      .select('empId name designation photo') // only needed fields
      .lean();

    res.json(employees);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ GET Attendance Records with Pagination
router.get('/attendances', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const records = await Attendance.find({})
      .skip(skip)
      .limit(limit)
      .sort({ date: -1 })
      .select('-__v') // remove unused field
      .lean();

    res.json(records);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ GET employee by empId (with selected fields)
router.get('/user/:empId', async (req, res) => {
  try {
    const empId = req.params.empId;

    const user = await Employee.findOne({ empId })
      .select('empId name photo email designation') // include only needed
      .lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching user data' });
  }
});

// ✅ PUT update photo
router.put('/user/:empId', async (req, res) => {
  try {
    const empId = req.params.empId;
    const { photo } = req.body;

    const user = await Employee.findOneAndUpdate(
      { empId },
      { photo },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'Photo updated', photo: user.photo });
  } catch (err) {
    res.status(500).json({ error: 'Error updating photo' });
  }
});

module.exports = router;
