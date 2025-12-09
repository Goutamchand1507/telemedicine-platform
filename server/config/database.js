const knex = require('knex');
const crypto = require('crypto');

// Debug logs (only in development mode)
if (process.env.NODE_ENV !== "production") {
  console.log('🔍 Database Configuration Debug:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_PORT:', process.env.DB_PORT);
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_NAME:', process.env.DB_NAME);
}

// Use DATABASE_URL on Render (production)
const isProduction = !!process.env.DATABASE_URL;

const connectionConfig = isProduction
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false, // Render requires this
      },
    }
  : {
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "telemedicine",
      ssl: false,
    };

const db = knex({
  client: "pg",
  connection: connectionConfig,
  migrations: { directory: "./migrations" },
  seeds: { directory: "./seeds" },
  pool: { min: 2, max: 10 },
});

console.log(`📊 Using connection: ${isProduction ? "DATABASE_URL" : "Local DB"}`);

// ============================
// ENCRYPTION UTILITIES
// ============================
const algorithm = "aes-256-gcm";

// Ensure ENCRYPTION_KEY exists in production
let secretKey;

if (process.env.ENCRYPTION_KEY) {
  secretKey = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
} else {
  secretKey = crypto.randomBytes(32);
  console.warn("⚠️ WARNING: ENCRYPTION_KEY missing — generating temporary key.");
}

function encrypt(text) {
  if (!text) return null;

  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  } catch (error) {
    console.error("Encryption error:", error);
    return null;
  }
}

function decrypt(data) {
  if (!data || !data.encrypted) return null;

  try {
    const iv = Buffer.from(data.iv, "hex");
    const authTag = Buffer.from(data.authTag, "hex");

    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(data.encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    return null;
  }
}

// ============================
// DATABASE INITIALIZER
// ============================
async function initializeDatabase() {
  try {
    await db.raw("SELECT 1");
    console.log("✅ Database connected successfully");

    await db.migrate.latest();
    console.log("✅ Migrations completed");

    return true;
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
    throw err;
  }
}

async function checkDatabaseHealth() {
  try {
    await db.raw("SELECT 1");
    return { status: "healthy" };
  } catch (err) {
    return { status: "unhealthy", error: err.message };
  }
}

module.exports = {
  db,
  encrypt,
  decrypt,
  initializeDatabase,
  checkDatabaseHealth,
};
