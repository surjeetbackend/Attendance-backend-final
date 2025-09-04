const express = require("express");
const admin = require("firebase-admin");
const axios = require("axios");
require("dotenv").config();


const router = express.Router();

if (!admin.apps.length) {
  // Parse JSON string from environment variable if needed:
  // const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
  // Or require JSON file if path is given:
 const serviceAccountRaw = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
serviceAccountRaw.private_key = serviceAccountRaw.private_key.replace(/\\n/g, '\n');

// Replace escaped newlines with actual newlines


  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountRaw)
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
// ------------------ POST: Update Location ------------------
router.post("/update-location", async (req, res) => {
  try {
    const { empId, latitude, longitude } = req.body;

    if (!empId || !latitude || !longitude) {
      return res.status(400).json({ error: "empId, latitude, longitude required" });
    }

    const docRef = db.collection("locations").doc(empId);

    // 🌐 Get location name using reverse geocoding
    const locationName = await getAddress(latitude, longitude);

    const locationEntry = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      locationName, // ⬅️ ADD this field
      updatedAt: new Date().toISOString(),
    };

    const dateKey = new Date().toISOString().split("T")[0];

    // ✅ Always update latest
    await docRef.set(
      {
        latest: locationEntry,
      },
      { merge: true }
    );

    // ✅ Push into history manually
    const docSnap = await docRef.get();
    const existingData = docSnap.data() || {};
    const history = existingData.history || {};
    const todayHistory = history[dateKey] || [];

    todayHistory.push(locationEntry);

    await docRef.update({
      [`history.${dateKey}`]: todayHistory,
    });

    return res.json({ message: "📍 Location updated successfully", locationEntry });
  } catch (err) {
    console.error("❌ Error updating location:", err);
    return res.status(500).json({ error: "Failed to update location" });
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
    console.error("Fetch locations error:", err.stack || err);
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
    console.error("Fetch employee location error:", err.stack || err);
    res.status(500).json({ message: "Error fetching employee location" });
  }
});

module.exports = router;
