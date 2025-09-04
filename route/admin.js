const express = require('express');
const Employee = require('../model/user');
const Attendance = require('../model/Attendance');
const router = express.Router();
const ExcelJS = require("exceljs");
const Notification = require("../model/Notification");
const Profile = require('../model/empslry');   
router.post("/download", async (req, res) => {
  try {
    let { date, fromDate, toDate } = req.body;
    let records = [];

    //  Single Date
    if (date) {
      const inputDate = new Date(date);
      if (isNaN(inputDate)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }

      const formattedWithZero = inputDate.toLocaleDateString("en-US");
      const formattedWithoutZero = `${inputDate.getMonth() + 1}/${inputDate.getDate()}/${inputDate.getFullYear()}`; 

      records = await Attendance.find({
        date: { $in: [formattedWithZero, formattedWithoutZero] }
      });
    }

    // Date custom 
    else if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);

      if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({ message: "Invalid date range format. Use YYYY-MM-DD" });
      }

      
      let dateList = [];
      let current = new Date(start);
      while (current <= end) {
        let withZero = current.toLocaleDateString("en-US"); 
        let withoutZero = `${current.getMonth() + 1}/${current.getDate()}/${current.getFullYear()}`; 
        dateList.push(withZero, withoutZero);
        current.setDate(current.getDate() + 1);
      }

      records = await Attendance.find({ date: { $in: dateList } });
    }

    else {
      return res.status(400).json({ message: "Please provide either 'date' or 'fromDate' & 'toDate'" });
    }

    if (!records.length) {
      return res.status(404).json({ message: "No records found for the given date(s)" });
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
      { header: "Out Location", key: "outLocation", width: 40 },
    ];

    records.forEach(r => worksheet.addRow(r));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${date || fromDate + "_to_" + toDate}.xlsx`
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
      .select('empId name email phone hireDate photo designation')
      .lean();


    const employeeIds = employees.map(e => e._id);
    const profiles = await Profile.find({ users: { $in: employeeIds } })
      .select('users slry Des DOB Company_Name userAccount')
      .lean();

   
    const profileMap = {};
    profiles.forEach(p => {
      profileMap[p.users.toString()] = p;
    });

    const result = employees.map(e => ({
      ...e,
      profile: profileMap[e._id.toString()] || null
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});




router.get('/attendances', async (req, res) => {
  try {
    const { empId } = req.query;

    const query = empId ? { empId } : {};

  
    const records = await Attendance.find(query)
      .sort({ date: 1 }) 
      .select('-__v')
      .lean();

    res.json(records);
  } catch (err) {
    console.error("Error fetching attendance:", err);
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

   
    const profile = await Profile.findOne({ users: user._id })
      .select('slry Des DOB Company_Name userAccount')
      .lean();

    res.json({
      ...user,
      profile: profile || null
    });
  } catch (err) {
    console.error(err);
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
await Notification.create({
      empId: user.empId,
      message: `Your profile was updated successfully.`
    });

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
    await Notification.create({
      empId,
      message: `Your account has been deleted from the system.`
    });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting user' });
  }
});
router.get('/notifications/:empId', async (req, res) => {
  try {
    const { empId } = req.params;
    const notifications = await Notification.find({ empId })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching notifications' });
  }
});


module.exports = router;
