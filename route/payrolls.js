const express = require("express");
const router = express.Router();
const Payroll = require("../model/payroll"); 
const Employee = require("../model/user"); 

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

    // ✅ Check if Employee exists
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

    // salary calculations
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

// ✅ 4. Update Payroll (recalculate netPayable if needed)
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

// ✅ 5. Delete Payroll
router.delete("/:id", async (req, res) => {
  try {
    await Payroll.findByIdAndDelete(req.params.id);
    res.json({ message: "Payroll deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting payroll", error });
  }
});


module.exports = router;
