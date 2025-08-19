const mongoose=require('mongoose');
const user = require('./user');

const profile=mongoose.Schema({
    // user:{type:mongoose.Schema.ObjectId,ref:'User',required:true, unique:true},
    user: { type: String, required: true, unique: true },
    userAccount:{
        bank_name:{type:String,},
        account_number:{type:Number},
        Ifsc_code:{type:String},
    },
    slry:{type:Number,required:true},
    Des:{type:String,required:true},
    DOB:{type:Date,required:true},
    Company_Name:{type:String,required:true},
});

module.exports=mongoose.model('profile',profile);