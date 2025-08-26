
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  empId: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false } // dashboard pe dekha gaya ya nahi
});

module.exports = mongoose.model("Notification", notificationSchema);
