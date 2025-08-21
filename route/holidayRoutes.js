
const express = require("express");
const router = express.Router();
const Holiday = require("../model/holidays");


router.post("/", async (req, res) => {
  try {
    const { name, date, day } = req.body;
    const newHoliday = new Holiday({ name, date, day });
    await newHoliday.save();
    res.status(201).json({ message: "Holiday added", holiday: newHoliday });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add holiday" });
  }
});


router.get("/get", async (req, res) => {
  try {
    const holidays = await Holiday.find();
    res.json(holidays);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

