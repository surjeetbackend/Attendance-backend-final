const express = require("express");
const router = express.Router();
const Payroll = require("../model/payroll"); 
const Employee = require("../model/user"); 
const ExcelJS = require("exceljs");


const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
router.get("/download/:month", async (req, res) => {
  try {
    let { month } = req.params; 
    let formattedMonth = month;

  
    if (/^\d{4}-\d{2}$/.test(month)) {
      const [year, m] = month.split("-");
      const monthName = monthNames[parseInt(m, 10) - 1]; 
      formattedMonth = `${monthName}-${year}`;
    }

    else if (/^[A-Za-z]{3,9}[- ]?\d{4}$/.test(month)) {
      const [mon, year] = month.split(/[- ]/);
      const idx = monthNames.findIndex(m => m.toLowerCase().startsWith(mon.toLowerCase()));
      if (idx >= 0) {
        formattedMonth = `${monthNames[idx]}-${year}`;
      }
    }

    const payrolls = await Payroll.find({
      month: { $regex: new RegExp(`^${formattedMonth}$`, "i") }
    });

    if (!payrolls || payrolls.length === 0) {
      return res.status(404).json({ message: `No payroll found for ${formattedMonth}` });
    }


    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Payroll-${formattedMonth}`);

    worksheet.columns = [
      { header: "Employee ID", key: "empId", width: 15 },
      { header: "Month", key: "month", width: 15 },
      { header: "Total Office Days", key: "totalOfficeDays", width: 18 },
      { header: "Present Days", key: "presentDays", width: 15 },
      { header: "Leave Days", key: "leaveDays", width: 15 },
      { header: "Absent Days", key: "absentDays", width: 15 },
      { header: "Salary", key: "salary", width: 15 },
      { header: "Per Day Cost", key: "perDayCost", width: 15 },
      { header: "Advance", key: "advance", width: 15 },
      { header: "Food", key: "food", width: 15 },
      { header: "Net Payable", key: "netPayable", width: 15 },
    ];

    
    payrolls.forEach((p) => {
      worksheet.addRow({
        empId: p.empId || "N/A",
        month: p.month,
        totalOfficeDays: p.totalOfficeDays,
        presentDays: p.presentDays,
        leaveDays: p.leaveDays,
        absentDays: p.absentDays,
        salary: p.salary,
        perDayCost: p.perDayCost,
        advance: p.advance,
        food: p.food,
        netPayable: p.netPayable,
      });
    });

   
    worksheet.getRow(1).font = { bold: true };

   
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Payroll-${formattedMonth}.xlsx`
    );

   
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Excel download error:", error);
    res.status(500).json({ message: "Error generating Excel", error: error.message });
  }
});


// router.post("/create-aproll", async (req, res) => {
//   try {
//     const {
//       empId,
//       month,
//       basicslry,
//       hra,
//       allowance,
//       deducation,
//       presentDays,
//       totaldays,
//     } = req.body;

//     // Salary Calculation
//     const proratedSalary = (presentDays / totaldays) * basicslry;
//     const grossslry = proratedSalary + (hra || 0) + (allowance || 0);

//     const totalDeduction =
//       (deducation?.pf || 0) +
//       (deducation?.esi || 0) +
//       (deducation?.tds || 0) +
//       (deducation?.other || 0);

//     const netslry = grossslry - totalDeduction;

//     const payroll = new Payroll({
//       empId,
//       month,
//       basicslry,
//       hra,
//       allowance,
//       deducation,
//       presentDays,
//       totaldays,
//       grossslry,
//       netslry,
//     });

//     await payroll.save();
//     res.status(201).json({ message: "Payroll generated successfully", payroll });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Error generating payroll", error });
//   }
// });
// Create payroll by empId
router.post("/create-aproll/:empId", async (req, res) => {
  try {
    const empId = req.params.empId;


    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({ message: `Employee with ID ${empId} does not exist` });
    }

    const {
      month,
      totalOfficeDays,
      presentDays,
      salary,
      leaveDays,
      absentDays,
      advance,
      food,
    } = req.body;

      const existingPayroll = await Payroll.findOne({ empId, month });
    if (existingPayroll) {
      return res.status(400).json({
        message: `Payroll for Employee ${empId} already exists for ${month}`,
        // payroll: existingPayroll,
      });
    }

   
    const perDayCost = salary / totalOfficeDays;
    const payableForDays = perDayCost * presentDays;
    const deductions = (advance || 0) + (food || 0);
    const netPayable = payableForDays - deductions;

    const payroll = new Payroll({
      empId,
      month,
      totalOfficeDays,
      presentDays,
      perDayCost,
      salary,
      leaveDays,
      absentDays,
      advance,
      food,
      netPayable,
    });

    await payroll.save();
    res.status(201).json({ message: "Payroll generated successfully", payroll });
  } catch (error) {
    res.status(500).json({ message: "Error creating payroll", error });
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
      leaveDays,
      absentDays,
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
