
const express = require("express");
const router = express.Router();
const Holiday = require("../model/holidays");


router.get("/", async (req, res) => {
  try {
    const holidays = await Holiday.find();
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


router.post("/add", async (req, res) => {
  try {
    const holidays = req.body; 
    await Holiday.insertMany(holidays);
    res.json({ message: "Holidays added successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to add holidays" });
  }
});

module.exports = router;
