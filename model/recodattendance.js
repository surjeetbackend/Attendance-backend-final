
const mongoose = require("mongoose");
const monthlySummarySchema = new mongoose.Schema({
  empId: { type: String, required: true },
  month: { type: String, required: true }, 
  present: { type: Number, default: 0 },
  leave: { type: Number, default: 0 },
  halfday: { type: Number, default: 0 }, 
  absent: { type: Number, default: 0 },
});

monthlySummarySchema.index({ empId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("MonthlySummary", monthlySummarySchema);
