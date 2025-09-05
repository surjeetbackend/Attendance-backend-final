// redisClient.js
const redis = require("redis");

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
  username: process.env.REDIS_USERNAME || "default", // agar username ka option ho
  password: process.env.REDIS_PASSWORD,
});

client.on("error", (err) => {
  console.error("❌ Redis Client Error:", err);
});

(async () => {
  try {
    await client.connect();
    console.log("✅ Redis connected successfully");
  } catch (err) {
    console.error("Redis connection failed:", err);
  }
})();
(async () => {
  try {
    await client.set("testKey", "HelloRedis");
    const value = await client.get("testKey");
    console.log("🎯 Test value from Redis:", value);
  } catch (err) {
    console.error("Test failed:", err);
  }
})();

module.exports = client;
