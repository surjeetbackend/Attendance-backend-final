const express = require('express');
const router = express.Router();
const User = require('../model/user');
const bcrypt = require('bcrypt');

// Register a new employee
router.post('/register-form', async(req, res) => {
    try {
        const { name, email, password, phone, photo, gender, dob, shift } = req.body;

        // Validate required fields
        if (!name || !email || !password || !phone || !photo) {
            return res.status(400).json({ error: 'Please fill all required fields' });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        // Generate employee ID
        const empId = name.substring(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 900);
        const hashedPassword = await bcrypt.hash(password, 10);
        const hireDate = new Date().toLocaleDateString();

        // Create and save user
        const newUser = new User({
            empId,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            photo,
            gender: gender,
            dob: dob,
            shift: shift,
            hireDate,
            password: hashedPassword,
        });

        await newUser.save();
        res.json({ message: 'Registered successfully', empId });

    } catch (err) {
        console.error('Register error:', err );
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Employee login
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

        res.json({ message: 'Login successful', name: user.name, empId: user.empId });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

module.exports = router;