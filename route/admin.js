const express = require('express');
const Employee = require('../model/user');
const Attendance = require('../model/Attendance');
const router = express.Router();
const { Parser } = require('json2csv');


router.get('/attendances/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // today start
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // tomorrow start

    const records = await Attendance.find({
      date: { $gte: today, $lt: tomorrow } // today only
    })
      .populate('empId', 'empId name email phone') // Employee info
      .sort({ inTime: 1 })
      .lean();

    if (!records.length) return res.status(404).json({ message: 'No records found today' });

    res.json({ message: 'Today attendance fetched', records });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});




router.get('/user', async (req, res) => {
  try {
    const employees = await Employee.find({})
      .select('empId name email phone hireDate photo ') 
      .lean();

    res.json(employees);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/attendances', async (req, res) => {
  try {
    const { empId, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const query = empId ? { empId } : {};

    const records = await Attendance.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ date: -1 })
      .select('-__v')
      .lean();

    res.json(records);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.get('/user/:empId', async (req, res) => {
  try {
    const empId = req.params.empId;

    const user = await Employee.findOne({ empId })
      .select('empId name photo email designation') 
      .lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching user data' });
  }
});


router.put('/user/:empId/update', async (req, res) => {
  try {
    const empId = req.params.empId;
    let updateData = req.body;

    
    const blockeddata = ['empId', 'password', 'photo']; 

    blockeddata.forEach(field => delete updateData[field]);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    const user = await Employee.findOneAndUpdate(
      { empId },
      { $set: updateData },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating user' });
  }
});

router.delete('/user/:empId/delete', async (req, res) => {
  try {
    const empId = req.params.empId;
    const user = await Employee.findOneAndDelete({ empId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting user' });
  }
});


module.exports = router;
