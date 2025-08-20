const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  day: { type: String, required: true }
});

module.exports = mongoose.model("Holiday", holidaySchema);