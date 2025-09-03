const express = require("express");
const admin = require("firebase-admin");
const axios = require("axios");
require("dotenv").config();

const router = express.Router();

if (!admin.apps.length) {
  const serviceAccount = require("../serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const OPENCAGE_KEY = process.env.OPENCAGE_API_KEY;

// Convert lat/lng to address
async function getAddress(latitude, longitude) {
  try {
    const response = await axios.get(
      `https://api.opencagedata.com/geocode/v1/json?q=${latitude},${longitude}&key=${OPENCAGE_KEY}`
    );
    if (response.data && response.data.results && response.data.results.length > 0) {
      return response.data.results[0].formatted;
    } else {
      return `${latitude},${longitude}`; // fallback
    }
  } catch (err) {
    console.error("Geocoding error:", err.message);
    return `${latitude},${longitude}`; // fallback
  }
}

// ------------------ POST: Update Location ------------------
router.post("/update-location", async (req, res) => {
  try {
    const { empId, latitude, longitude } = req.body;

    if (!empId || !latitude || !longitude) {
      return res.status(400).json({ message: "empId, latitude, longitude required" });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const timestamp = new Date().toISOString();
    const address = await getAddress(lat, lng);

    const dateKey = timestamp.split("T")[0]; // e.g., "2025-09-03"
    const locationEntry = {
      latitude: lat,
      longitude: lng,
      address,
      updatedAt: timestamp
    };

    const docRef = db.collection("locations").doc(empId);

    // Store latest and date-wise grouped history
    await docRef.set(
      {
        latest: locationEntry,
        [`history.${dateKey}`]: admin.firestore.FieldValue.arrayUnion(locationEntry)
      },
      { merge: true }
    );

    res.status(200).json({ message: "Location updated successfully", address });
  } catch (err) {
    console.error("Update location error:", err);
    res.status(500).json({ message: "Error updating location" });
  }
});

// ------------------ GET: All Latest Locations ------------------
router.get("/track-location", async (req, res) => {
  try {
    const snapshot = await db.collection("locations").get();
    const locations = [];
    snapshot.forEach(doc => {
      locations.push({ empId: doc.id, ...doc.data().latest });
    });
    res.json({ locations });
  } catch (err) {
    console.error("Fetch locations error:", err);
    res.status(500).json({ message: "Error fetching locations" });
  }
});

// ------------------ GET: Single Employee ------------------
router.get("/track-location/:empId", async (req, res) => {
  try {
    const { empId } = req.params;
    const doc = await db.collection("locations").doc(empId).get();

    if (!doc.exists) return res.status(404).json({ message: "Employee not found" });

    const data = doc.data();
    res.json({
      empId: doc.id,
      latest: data.latest || null,
      history: data.history || {}
    });
  } catch (err) {
    console.error("Fetch employee location error:", err);
    res.status(500).json({ message: "Error fetching employee location" });
  }
});

module.exports = router;
