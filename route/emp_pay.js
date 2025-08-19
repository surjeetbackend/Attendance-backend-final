const express = require('express');
const Profile = require('../model/empslry');
const Employee = require('../model/user');
const router = express.Router();

router.post('/add-details', async (req, res) => {
    try {
        const { user, Company_Name, slry, DOB, Des, bank_name, account_number, Ifsc_code } = req.body;

       
        const existingprofile = await Profile.findOne({ user });
        if (existingprofile) {
            return res.status(400).json({ message: 'Employee details already added,cannot update again' });
        }

        const newslry = new Profile({
            user,
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

        await newslry.save();
        res.status(201).json({ message: 'Employee details added successfully', profile: newslry });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Server error', error });
    }
});

router.get('/get-details',async(req,res)=>{
    try {
        const slryby= await Profile.find({}).populate("user");
        res.status(200).json({message:'all details are fetched',profile: slryby});
    } catch (error) {
                console.log(error);
        res.status(500).json({ message: 'Server error', error });
    }
});
router.get('/get-details/:id',async(req,res)=>{
    try {
        const {id}=req.params;
        const slrybyone= await Profile.findOne({user:id}).populate("user");
        if (!slrybyone) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.status(200).json({message:'all details are fetched',profile: slrybyone});
    } catch (error) {
                console.log(error);
        res.status(500).json({ message: 'Server error', error });
    }
});



module.exports = router;
