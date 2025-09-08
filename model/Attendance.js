const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    empId: String,
    name: String,
    inTime: String,
    date: String,
    photo: String,
    outTime: String,
    // date: String,
    inLocation: String,
    outLocation: String,

});

module.exports = mongoose.model('Attendance', attendanceSchema);
