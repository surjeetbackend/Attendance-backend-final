const express = require('express');
const Profile = require('../model/empslry');
const Employee = require('../model/user');
const router = express.Router();

router.post('/add-details', async (req, res) => {
  try {
    const { EmpId, Company_Name, slry, DOB, Des, bank_name, account_number, Ifsc_code } = req.body;

    let profile = await Profile.findOne({ user: EmpId });

    if (!profile) {
   
      profile = new Profile({
        user: EmpId,
        Company_Name,
        slry,
        DOB,
        Des,
        userAccount: { bank_name, account_number, Ifsc_code },
      });
    } else {
     
      if (Company_Name) profile.Company_Name = Company_Name;
      if (slry) profile.slry = slry;
      if (DOB) profile.DOB = DOB;
      if (Des) profile.Des = Des;
      if (bank_name) profile.userAccount.bank_name = bank_name;
      if (account_number) profile.userAccount.account_number = account_number;
      if (Ifsc_code) profile.userAccount.Ifsc_code = Ifsc_code;
    }

    await profile.save();
    res.status(200).json({ message: 'Profile added/updated successfully', profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error });
  }
});

router.get('/get-details',async(req,res)=>{
    try {
        const slryby= await Employee.find({}).populate("user");
        res.status(200).json({message:'all details are fetched',profile: slryby});
    } catch (error) {
                console.log(error);
        res.status(500).json({ message: 'Server error', error });
    }
});
router.get('/get-details/:id', async (req, res) => {
 try {
    const { empId } = req.params;

  
    const profile = await Profile.findOne({ user: empId }).populate('users', 'name email phone'); 


    if (!profile) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.status(200).json({
      message: 'Employee full details fetched successfully',
      registration: profile.users, 
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
