const express = require("express");
const router = express.Router();
const Payroll = require("../model/payroll"); 
const Employee = require("../model/user"); 
const Attendance = require("../model/Attendance");
const MonthlySummary= require('../model/recodattendance')
const ExcelJS = require("exceljs");
const Profile = require("../model/empslry");
const Holiday = require('../model/holidays'); 

async function getProfileByEmpId(empId) {
  // Try finding profile by 'user' field (string empId)
  let profile = await Profile.findOne({ user: empId });
  if (profile) return profile;

  // If not found, try by users (ObjectId referencing User)
  const employee = await Employee.findOne({ empId });
  if (employee) {
    profile = await Profile.findOne({ users: employee._id });
    return profile;
  }

  return null; // no profile found
}
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
async function calculateWorkingDays(year, month) {
  // Fetch holidays in the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const holidays = await Holiday.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  });

  // Convert holiday dates to string for easy comparison
  const holidayDates = holidays.map(h => h.date.toISOString().split("T")[0]);

  let workingDays = 0;
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Sunday

    if (dayOfWeek === 0) continue; // Skip Sundays

    const dateString = date.toISOString().split("T")[0];
    if (holidayDates.includes(dateString)) continue; // Skip holidays

    workingDays++;
  }

  return workingDays;
}

router.get("/download/:month", async (req, res) => {
  try {
    const { month } = req.params;
    let year, m;

    // Month parsing
    if (/^\d{4}-\d{2}$/.test(month)) {
      [year, m] = month.split("-");
    } else {
      const parts = month.split(/[- ]/);
      if (parts.length !== 2) return res.status(400).json({ message: "Invalid month format" });
      const [mon, yr] = parts;
      year = yr;
      const idx = monthNames.findIndex(n => n.toLowerCase().startsWith(mon.toLowerCase()));
      if (idx < 0) return res.status(400).json({ message: "Invalid month name" });
      m = (idx + 1).toString().padStart(2, "0");
    }

    const formattedMonth = `${monthNames[parseInt(m) - 1]}-${year}`;
    const prefix = `${year}-${m}`;

    // fetch data
    const employees = await Employee.find();
    const summaries = await MonthlySummary.find({ month: prefix });
    const payrollMap = {};
    const payrollsFromDB = await Payroll.find({ month: prefix });
    payrollsFromDB.forEach(p => (payrollMap[p.empId] = p));

    // profiles fetch + map
    const profiles = await Profile.find().populate("users");
    const profileByEmpId = {};
    const profileByUserId = {};

    profiles.forEach(p => {
      if (p.user) profileByEmpId[p.user] = p; // stored as empId
      if (p.users) profileByUserId[p.users.toString()] = p; // stored as ObjectId
    });

    const totalOfficeDays = await calculateWorkingDays(parseInt(year), parseInt(m));
    const payrolls = [];

    for (const emp of employees) {
      const summary = summaries.find(s => s.empId === emp.empId) || {};
      const payroll = payrollMap[emp.empId] || {};

      // Profile match: try empId → then ObjectId
      const profile = profileByEmpId[emp.empId] || profileByUserId[emp._id.toString()] || {};

      payrolls.push({
        empId: emp.empId,
        name: emp.name,
        designation: profile.Des ?? "",
        company: profile.Company_Name ?? "",
        bankName: profile.userAccount?.bank_name ?? "",
        accountNumber: profile.userAccount?.account_number ?? "",
        ifsc: profile.userAccount?.Ifsc_code ?? "",
        month: formattedMonth,
        totalOfficeDays,
        presentDays: summary.present || 0,
        leaveDays: summary.leave || 0,
        halfdayDays: summary.halfday || 0,
        absentDays: summary.absent || 0,
        salary: payroll.salary ?? 0,
        perDayCost: payroll.perDayCost ?? 0,
        advance: payroll.advance ?? 0,
        food: payroll.food ?? 0,
        netPayable: payroll.netPayable ?? 0,
      });
    }

    // Excel create
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Payroll-${formattedMonth}`);

    worksheet.columns = [
      { header: "Employee ID", key: "empId", width: 15 },
      { header: "Name", key: "name", width: 20 },
      { header: "Designation", key: "designation", width: 20 },
      { header: "Company", key: "company", width: 20 },
      { header: "Bank Name", key: "bankName", width: 20 },
      { header: "Account Number", key: "accountNumber", width: 40 },
      { header: "IFSC Code", key: "ifsc", width: 15 },
      { header: "Month", key: "month", width: 15 },
      { header: "Total Office Days", key: "totalOfficeDays", width: 18 },
      { header: "Present Days", key: "presentDays", width: 15 },
      { header: "Leave Days", key: "leaveDays", width: 15 },
      { header: "Halfday Days", key: "halfdayDays", width: 15 },
      { header: "Absent Days", key: "absentDays", width: 15 },
      { header: "Salary", key: "salary", width: 15 },
      { header: "Per Day Cost", key: "perDayCost", width: 15 },
      { header: "Advance", key: "advance", width: 15 },
      { header: "Food", key: "food", width: 15 },
      { header: "Net Payable", key: "netPayable", width: 15 },
    ];

    payrolls.forEach(p => worksheet.addRow(p));
    worksheet.getRow(1).font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Payroll-${formattedMonth}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Payroll download error:", err);
    res.status(500).json({ message: "Error generating payroll", error: err.message });
  }
});


router.post("/create-aproll/:empId", async (req, res) => {
   try {
    const empId = req.params.empId;

    // Fetch employee
    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({ message: `Employee ${empId} not found` });
    }

    // Use helper to get profile
    const profile = await getProfileByEmpId(empId);
    if (!profile) {
      return res.status(404).json({ message: `Profile not found for ${empId}` });
    }

    const bankName = profile.userAccount?.bank_name || "";
    const accountNumber = profile.userAccount?.account_number || "";
    const ifscCode = profile.userAccount?.Ifsc_code || "";
    const designation = profile.Des || "";
    const companyName = profile.Company_Name || "";
    const salary = profile.slry;

    let { month, advance = 0, food = 0 } = req.body;

    if (!month || !salary) {
      return res.status(400).json({ message: "Month and salary are required" });
    }

    // Parse month into year and monthNumber
    let year, monthNumber;
    if (/^\d{4}-\d{2}$/.test(month)) {
      [year, monthNumber] = month.split("-");
      monthNumber = parseInt(monthNumber, 10);
    } else {
      const parts = month.split(/[- ]/);
      if (parts.length !== 2) {
        return res.status(400).json({ message: "Invalid month format" });
      }
      const [mon, yr] = parts;
      year = yr;
      monthNumber = monthNames.findIndex(m => m.toLowerCase().startsWith(mon.toLowerCase())) + 1;
      if (monthNumber === 0) {
        return res.status(400).json({ message: "Invalid month name" });
      }
    }

    const prefix = `${year}-${monthNumber.toString().padStart(2, "0")}`;

    // Fetch monthly summary
    const summary = await MonthlySummary.findOne({ empId, month: prefix });
    if (!summary) {
      return res.status(404).json({ message: `No monthly summary found for ${empId} in ${prefix}` });
    }

    // Calculate total office days (excluding Sundays and holidays)
    const startDate = new Date(`${year}-${monthNumber.toString().padStart(2, "0")}-01`);
    const endDate = new Date(year, monthNumber, 0);
    const holidays = await Holiday.find({ date: { $gte: startDate, $lte: endDate } });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split("T")[0]));

    let totalOfficeDays = 0;
    for (let day = 1; day <= endDate.getDate(); day++) {
      const date = new Date(year, monthNumber - 1, day);
      const isSunday = date.getDay() === 0;
      const dateStr = date.toISOString().split("T")[0];
      const isHoliday = holidayDates.has(dateStr);
      if (!isSunday && !isHoliday) {
        totalOfficeDays++;
      }
    }

    const presentDays = summary.present || 0;
    const leaveDays = summary.leave || 0;
    const halfdayDays = summary.halfday || 0;
    const absentDays = summary.absent || 0;

    // Calculate salary details
    const perDayCost = salary / totalOfficeDays;
    const fullPaidDays = presentDays + leaveDays;
    const halfPaidDays = halfdayDays * 0.5;
    const payableDays = fullPaidDays + halfPaidDays;

    const payableForDays = perDayCost * payableDays;
    const netPayable = payableForDays - (advance + food);

    // Check if payroll already exists
    const existing = await Payroll.findOne({ empId, month: prefix });
    if (existing) {
      return res.status(400).json({ message: `Payroll already exists for ${empId} in ${prefix}` });
    }

    // Create new payroll
    const payroll = new Payroll({
      empId,
      month: prefix,
      totalOfficeDays,
      presentDays,
      leaveDays,
      halfdayDays,
      absentDays,
      salary,
      perDayCost,
      advance,
      food,
      netPayable,
      designation,
      companyName,
      bankDetails: profile.userAccount,
    });

    await payroll.save();

    res.status(201).json({
      message: "Payroll created successfully",
      payroll,
    });
  } catch (error) {
    console.error("Payroll error:", error);
    res.status(500).json({
      message: "Failed to create payroll",
      error: error.message,
    });
  }
});




router.get("/payroll/:empId", async (req, res) => {
  try {
    const payrolls = await Payroll.find({ empId: req.params.empId });
    res.json(payrolls);
  } catch (error) {
    res.status(500).json({ message: "Error fetching payroll", error });
  }
});


router.put("/:id", async (req, res) => {
  try {
    const {
      totalOfficeDays,
      presentDays,
      salary,
      advance,
      food
    } = req.body;

    let perDayCost, netPayable;

    if (salary && totalOfficeDays && presentDays !== undefined) {
      perDayCost = salary / totalOfficeDays;
      const payableForDays = perDayCost * presentDays;
      const deductions = (advance || 0) + (food || 0);
      netPayable = payableForDays - deductions;
    }

    const updated = await Payroll.findByIdAndUpdate(
      req.params.id,
      { ...req.body, perDayCost, netPayable },
      { new: true }
    );

    res.json({ message: "Payroll updated", updated });
  } catch (error) {
    res.status(500).json({ message: "Error updating payroll", error });
  }
});

router.delete("/emp/:empId/:month", async (req, res) => {
  try {
    const { empId, month } = req.params;
    const deleted = await Payroll.findOneAndDelete({ empId, month });
    if (!deleted) {
      return res.status(404).json({ message: `No payroll found for ${empId} in ${month}` });
    }
    res.json({ message: `Payroll for ${empId} (${month}) deleted`, deleted });
  } catch (error) {
    res.status(500).json({ message: "Error deleting payroll", error });
  }
});


module.exports = router;
