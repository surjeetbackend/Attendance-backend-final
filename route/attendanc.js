const express = require('express');
const router = express.Router();
const axios = require('axios');
const Attendance = require('../model/Attendance');
require('dotenv').config();

async function getAddressFromCoords(coords) {
    try {
        const [lat, lng] = coords.split(',').map(s => s.trim());
        const response = await axios.get(
            `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${process.env.OPENCAGE_API_KEY}`
        );
        const formatted = (response.data.results && response.data.results[0] && response.data.results[0].formatted) || coords;
        return formatted;
    } catch (error) {
        console.error('Geocoding error:', error.message);
        return coords;
    }
}

router.post('/mark', async(req, res) => {
    const { empId, name, type, location, photo } = req.body;

    if (!empId || !name || !type || !location) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata" });
    const date = now.toLocaleDateString();

    try {
        const locationName = await getAddressFromCoords(location);

        let attendance = await Attendance.findOne({ empId, date });

       
        if (attendance) {
          
            if (type === 'in' && attendance.inTime) {
                return res.status(400).json({ error: 'In-Time already marked for today' });
            }

            
            if (type === 'out' && attendance.outTime) {
                return res.status(400).json({ error: 'Out-Time already marked for today' });
            }

          
            if (type === 'in') {
                attendance.inTime = time;
                attendance.inLocation = locationName;
                if (photo) attendance.photo = photo;
            } else if (type === 'out') {
                attendance.outTime = time;
                attendance.outLocation = locationName;
            }
  


            await attendance.save();
            return res.json({ message: `Attendance ${type === 'in' ? 'in-time' : 'out-time'} marked successfully` });

        } else {
      
            const newAttendance = new Attendance({
                empId,
                name,
                photo: photo || '',
                date,
                inTime: type === 'in' ? time : '',
                outTime: type === 'out' ? time : '',
                inLocation: type === 'in' ? locationName : '',
                outLocation: type === 'out' ? locationName : '',
            });

            await newAttendance.save();
            return res.json({ message: `Attendance ${type === 'in' ? 'in-time' : 'out-time'} marked successfully` });
        }
    } catch (err) {
        console.error('Attendance Save Error:', err);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
});

module.exports = router;
