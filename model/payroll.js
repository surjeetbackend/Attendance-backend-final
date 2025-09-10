const mongoose = require("mongoose");

const PayrollSchema = new mongoose.Schema({
  empId: { type: String, required: true },
  month: { type: String, required: true },

  totalOfficeDays: { type: Number, required: true },
  presentDays: { type: Number, required: true },     
  perDayCost: { type: Number },                    
  salary: { type: Number, required: true },          

  leaveDays: { type: Number, default: 0 },          
  absentDays: { type: Number, default: 0 },         

  advance: { type: Number, default: 0 },           
  food: { type: Number, default: 0 },               

  netPayable: { type: Number },   
  bankName: { type: String },
accountNumber: { type: Number },
ifscCode: { type: String },
designation: { type: String },
companyName: { type: String },
                 

  generatedDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Payroll", PayrollSchema);
