const express = require('express');
const Profile = require('../model/empslry');
const Employee = require('../model/user');
const router = express.Router();


router.post('/add-details', async (req, res) => {
  try {
    const { empId, Company_Name, slry, DOB, Des, bank_name, account_number, Ifsc_code } = req.body;


    const employee = await Employee.findOne({ empId });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const existingProfile = await Profile.findOne({ users: employee._id });
    if (existingProfile) return res.status(400).json({ message: 'Employee profile already added' });

    const newProfile = new Profile({
      users: employee._id,
      user: employee.empId,
      Company_Name,
      slry,
      DOB,
      Des,
      userAccount: {
        bank_name,
        account_number,
        Ifsc_code
      },
    });

    await newProfile.save();
    res.status(201).json({ message: 'Employee profile added successfully', profile: newProfile });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error });
  }
});

router.get('/get-details', async (req, res) => {
  try {
    const profiles = await Profile.find({})
      .populate('users', 'empId name email phone') 
      .lean();

    res.status(200).json({ message: 'All employee profiles fetched', profiles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error });
  }
});


router.get('/get-details/:empId', async (req, res) => {
  try {
    const { empId } = req.params;

    const employee = await Employee.findOne({ empId });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const profile = await Profile.findOne({ users: employee._id })
      .populate('users', 'empId name email phone')
      .lean();

    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    res.status(200).json({
      message: 'User and profile details fetched successfully',
      user: profile.users,
      profile: {
        Company_Name: profile.Company_Name,
        slry: profile.slry,
        DOB: profile.DOB,
        Des: profile.Des,
        userAccount: profile.userAccount
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error });
  }
});

module.exports = router;
