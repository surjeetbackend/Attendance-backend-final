const express = require('express');
const Employee = require('../model/user');
const Attendance = require('../model/Attendance');
const router = express.Router();
const ExcelJS = require("exceljs");

router.post("/download", async (req, res) => {
  try {
    let { date } = req.body; 

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }
const inputDate = new Date(date);
    if (isNaN(inputDate)) {
      return res.status(400).json({ message: "Invalid date format. Use MM/DD/YYYY" });
    }

    const formattedWithZero = inputDate.toLocaleDateString("en-US"); 
    const formattedWithoutZero = `${inputDate.getMonth() + 1}/${inputDate.getDate()}/${inputDate.getFullYear()}`; 

    const records = await Attendance.find({
      date: { $in: [formattedWithZero, formattedWithoutZero] }
    });

    if (!records.length) {
      return res.status(404).json({ message: "No records found for this date" });
    }


    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Attendance");

    worksheet.columns = [
      { header: "Emp ID", key: "empId", width: 15 },
      { header: "Name", key: "name", width: 20 },
      { header: "Date", key: "date", width: 15 },
      { header: "In Time", key: "inTime", width: 15 },
      { header: "Out Time", key: "outTime", width: 15 },
      { header: "In Location", key: "inLocation", width: 40 },
      { header: "Out Location", key: "outLocation", width: 40 }
    ];

    records.forEach(r => worksheet.addRow(r));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${date}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ message: "Server error" });
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
