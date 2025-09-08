const express = require('express');
const router = express.Router();
const axios = require('axios');
const Attendance = require('../model/Attendance');
const MonthlySummary = require("../model/recodattendance");
const Holiday = require("../model/holidays"); // 👈 Add this

require('dotenv').config();

async function getAddressFromCoords(coords) {
    try {
        const [lat, lng] = coords.split(',').map(s => s.trim());
        const response = await axios.get(
            `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${process.env.OPENCAGE_API_KEY}`
        );
        const formatted = (response.data.results && response.data.results[0] && response.data.results[0].formatted) || coords;
        return formatted;
    } catch (error) {
        console.error('Geocoding error:', error.message);
        return coords;
    }
}

// Utility function to determine attendance status
function determineStatus(inTime, outTime) {
    if (inTime && outTime) return "present";
    if (inTime || outTime) return "halfday";
    return "absent";
}

async function updateMonthlySummary(empId, dateStr, status) {
  const [month, day, year] = dateStr.split("/");
  const formattedMonth = `${year}-${month.padStart(2, "0")}`;

  const updateField = {};
  if (status === "present") updateField.present = 1;
  else if (status === "leave") updateField.leave = 1;
  else if (status === "absent") updateField.absent = 1;
  else if (status === "halfday") updateField.halfday = 1;

  await MonthlySummary.updateOne(
    { empId, month: formattedMonth },
    { $inc: updateField },
    { upsert: true }
  );
}


router.post('/mark', async (req, res) => {
    const { empId, name, type, location, photo } = req.body;

    if (!empId || !name || !type || !location) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata" });
    const date = now.toLocaleDateString();

    try {
        const locationName = await getAddressFromCoords(location);

        let attendance = await Attendance.findOne({ empId, date });

        if (attendance) {
            if (type === 'in' && attendance.inTime) {
                return res.status(400).json({ error: 'In-Time already marked for today' });
            }

            if (type === 'out' && attendance.outTime) {
                return res.status(400).json({ error: 'Out-Time already marked for today' });
            }

            if (type === 'in') {
                attendance.inTime = time;
                attendance.inLocation = locationName;
                if (photo) attendance.photo = photo;
            } else if (type === 'out') {
                attendance.outTime = time;
                attendance.outLocation = locationName;
            }

            // Correct status calculation
            attendance.status = determineStatus(attendance.inTime, attendance.outTime);

            await attendance.save();

            // Update monthly summary with the updated status
            await updateMonthlySummary(empId, date, attendance.status);

            return res.json({ message: `Attendance ${type === 'in' ? 'in-time' : 'out-time'} marked successfully` });

        } else {
            const newAttendance = new Attendance({
                empId,
                name,
                photo: photo || '',
                date,
                inTime: type === 'in' ? time : '',
                outTime: type === 'out' ? time : '',
                inLocation: type === 'in' ? locationName : '',
                outLocation: type === 'out' ? locationName : '',
            });

            // Set status properly here too
            newAttendance.status = determineStatus(newAttendance.inTime, newAttendance.outTime);

            await newAttendance.save();

            await updateMonthlySummary(empId, date, newAttendance.status);

            return res.json({ message: `Attendance ${type === 'in' ? 'in-time' : 'out-time'} marked successfully` });
        }
    } catch (err) {
        console.error('Attendance Save Error:', err);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
});

// TEMPORARY route to backfill status in existing attendance data
router.get("/fix-attendance-status", async (req, res) => {
  try {
    const attendances = await Attendance.find({}); // saare records

    for (const att of attendances) {
      let status = "absent"; // default

      if (att.inTime && att.outTime) {
        status = "present";
      } else if (att.inTime || att.outTime) {
        status = "halfday";
      }

      if (att.status !== status) {
        await Attendance.updateOne({ _id: att._id }, { $set: { status } });
      }
    }

    res.json({ message: "Attendance statuses fixed" });
  } catch (error) {
    console.error("Fix status error:", error);
    res.status(500).json({ error: "Failed to fix attendance statuses", details: error.message });
  }
});

router.get("/rebuild-monthly-summary", async (req, res) => {
  try {
    const all = await Attendance.find({});
    const map = {};

    for (const att of all) {
      let dateObj;

      if (att.date instanceof Date) {
        dateObj = att.date;
      } else {
        dateObj = new Date(att.date);
        if (isNaN(dateObj)) continue;
      }

      const year = dateObj.getFullYear();
      const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
      const key = `${att.empId}-${year}-${month}`;

      if (!map[key]) {
        map[key] = {
          empId: att.empId,
          month: `${year}-${month}`,
          present: 0,
          leave: 0,
          halfday: 0,
          dates: new Set(),
        };
      }

      const status = att.status;
      if (status === "present") map[key].present++;
      else if (status === "leave") map[key].leave++;
      else if (status === "halfday") map[key].halfday++;

      const dateStr = dateObj.toISOString().split("T")[0]; // yyyy-mm-dd
      map[key].dates.add(dateStr);
    }

    for (const key in map) {
      const summary = map[key];
      const [yearStr, monthStr] = summary.month.split("-");
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Last date of month

      // Build all dates in the month
      const allDates = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        allDates.push(new Date(d));
      }

      // Sundays
      const nonSundayDates = allDates.filter(date => date.getDay() !== 0); // 0 = Sunday

      // Fetch holidays from DB
      const holidays = await Holiday.find({
        date: {
          $gte: startDate,
          $lte: endDate
        }
      });

      const holidayDates = holidays.map(h => h.date.toISOString().split("T")[0]);

      // Remove holidays
      const workingDates = nonSundayDates.filter(date => {
        const dateStr = date.toISOString().split("T")[0];
        return !holidayDates.includes(dateStr);
      });

      const totalWorkingDays = workingDates.length;

      const totalPresentLikeDays = summary.present + summary.leave + summary.halfday;
      const absent = Math.max(0, totalWorkingDays - totalPresentLikeDays);

      const cleanSummary = {
        empId: summary.empId,
        month: summary.month,
        present: summary.present,
        leave: summary.leave,
        halfday: summary.halfday,
        absent: absent,
      };

      await MonthlySummary.updateOne(
        { empId: summary.empId, month: summary.month },
        { $set: cleanSummary },
        { upsert: true }
      );
    }

    res.json({ message: "✅ Monthly summaries rebuilt (Sundays & DB holidays excluded)" });
  } catch (error) {
    console.error("Rebuild summary error:", error);
    res.status(500).json({
      error: "Failed to rebuild monthly summary",
      details: error.message,
    });
  }
});


module.exports = router;
