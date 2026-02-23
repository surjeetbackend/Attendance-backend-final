const express = require('express');
const router = express.Router();
const User = require('../model/user');
const bcrypt = require('bcrypt');

const { protect, authorize } = require("../middleware.js");

router.post(
  "/admin/create-user",
  // protect,
  // authorize("admin"),
  async (req, res) => {
    try {
      const { name, email, password, phone, hireDate, role } = req.body;

      if (!name || !email || !password || !phone || !hireDate || !role) {
        return res.status(400).json({
          error: "All fields required",
        });
      }

      const allowedRoles = ["employee", "manager", "hr_admin", "admin"];

      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          error: "Invalid role",
        });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ error: "User already exists" });
      }

      const empId =
        name.substring(0, 3).toUpperCase() +
        Math.floor(100 + Math.random() * 900);

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        empId,
        name,
        email,
        phone,
        hireDate: new Date(hireDate),
        password: hashedPassword,
        role,
      });

      await newUser.save();

      res.json({
        message: `${role} created successfully`,
        empId,
      });
    } catch (err) {
      res.status(500).json({ error: "Error creating user" });
    }
  }
);
router.post('/register-form',protect,authorize('hr_admin'), async (req, res) => {
  try {
    const { name, email, password, phone, photo, gender, hireDate } = req.body;

    if (!name || !email || !password || !phone || !photo || !hireDate) {
      return res.status(400).json({ error: 'Please fill all required fields' });
    }

  
    const existingUser = await User.findOne({
      $or: [{ email: email.trim().toLowerCase() }, { phone: phone.trim() }]
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User with this email or phone number already exists' });
    }


    const empId = name.substring(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 900);

    
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      empId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      photo,
      gender,
     
      hireDate: new Date(hireDate), 
      password: hashedPassword,
      originalPassword: password
    });

    await newUser.save();

    res.json({ message: 'Registered successfully', empId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});


router.post('/login', async(req, res) => {
    try {
        const { empId, password } = req.body;

        if (!empId || !password) {
            return res.status(400).json({ error: 'Please provide employee ID and password' });
        }

        const user = await User.findOne({ empId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        res.json({ message: 'Login successful', name: user.name, empId: user.empId,role:user.role });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

module.exports = router;
