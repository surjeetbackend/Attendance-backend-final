// models/LeaveModel.js
const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  employeeName: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  appliedAt: { type: Date, default: Date.now },
  approveBy: { type: String, default: '' },
  leaveType: { type: String, enum: ['paid', 'unpaid', 'partially paid'], default: 'unpaid' },
  paidDays: { type: Number, default: 0 },
  unpaidDays: { type: Number, default: 0 },
 hrComment:{type:String, default:'no remark'}
});


module.exports = mongoose.model('Leave', LeaveSchema);
