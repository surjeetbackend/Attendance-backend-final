const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

    empId: String,
    name: String,
    email: String,
    phone: String,
    password: String,
    gender: String,
    dob: String,
    hireDate: String,
    shift: String,
    photo: String, // base64 image  

});

module.exports = mongoose.model('User', userSchema);