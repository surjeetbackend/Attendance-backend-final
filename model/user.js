const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

    empId: String,
    name: String,
    email: String,
  phone: {
    type: String,
    required: true,
    unique: true
  },
    password: String,
    gender: String,
    dob: String,
  hireDate: { type: Date, required: true },

    shift: String,
    photo: String,
    
    paidLeave: {
    total: {
      type: Number,
      default: 14,
      min: 0
    },
    used: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  

  
  role: {
    type: String,
    enum: ['employee', 'manager', 'admin'],
    default: 'employee'
  }
    

});

module.exports = mongoose.model('User', userSchema);
