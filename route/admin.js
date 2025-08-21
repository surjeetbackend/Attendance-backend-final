const express = require('express');
const Employee = require('../model/user');
const Attendance = require('../model/Attendance');
const router = express.Router();
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');


async function handleAttendanceDownload(req, res, date) {
  try {
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const records = await Attendance.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (!records || records.length === 0) {
      return res.status(404).json({ message: "No records found for this date" });
    }

    // Transform the data
    const formattedRecords = records.map(r => ({
      empId: r.empId,
      name: r.name,
      date: new Date(r.date).toLocaleDateString("en-IN"), // e.g. 20/08/2025
      inTime: r.inTime || "",
      outTime: r.outTime || "",
      inLocation: r.inLocation || "",
      outLocation: r.outLocation || ""
    }));

    const fields = [
      { label: "Employee ID", value: "empId" },
      { label: "Name", value: "name" },
      { label: "Date", value: "date" },
      { label: "In Time", value: "inTime" },
      { label: "Out Time", value: "outTime" },
      { label: "In Location", value: "inLocation" },
      { label: "Out Location", value: "outLocation" },
    ];

    const json2csv = new Parser({ fields });
    const csv = json2csv.parse(formattedRecords);

    res.header("Content-Type", "text/csv");
    res.attachment(`attendance_${date.toISOString().split("T")[0]}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error("Error generating CSV:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
}

// Route 1: Download today's attendance (no date passed)
router.get('/attendances/today/download', async (req, res) => {
  const today = new Date();
  await handleAttendanceDownload(req, res, today);
});

// Route 2: Download attendance for a specific date
router.get('/attendances/today/download/:date', async (req, res) => {
  const { date } = req.params;
  if (!date) {
    return res.status(400).json({ message: "Please provide a date" });
  }
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
  }
  await handleAttendanceDownload(req, res, parsedDate);
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
