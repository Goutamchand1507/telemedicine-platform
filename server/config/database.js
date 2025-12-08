const knex = require('knex');
const crypto = require('crypto');

// Debug: Log environment variables
console.log('🔍 Database Configuration Debug:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL (first 50 chars):', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'NOT SET');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);

// Use DATABASE_URL if available (Railway, Heroku, etc.), otherwise use individual env vars
const config = {
  client: 'pg',
  connection: process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  } : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'telemedicine_db',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  migrations: {
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  },
  pool: {
    min: 2,
    max: 10
  }
};

console.log('📊 Using connection config:', process.env.DATABASE_URL ? 'DATABASE_URL' : 'Individual env vars');

const db = knex(config);

// Encryption utilities for PHI data
const algorithm = 'aes-256-gcm';
// Ensure the key is exactly 32 bytes for AES-256
const secretKey = process.env.ENCRYPTION_KEY
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : crypto.randomBytes(32);

function encrypt(text) {
  if (!text) return null;

  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
}

function decrypt(encryptedData) {
  if (!encryptedData || !encryptedData.encrypted) return null;

  try {
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

// Database initialization
async function initializeDatabase() {
  try {
    // Test database connection
    await db.raw('SELECT 1');
    console.log('✅ Database connection established');
    
    // Run migrations
    await db.migrate.latest();
    console.log('✅ Database migrations completed');
    
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Health check
async function checkDatabaseHealth() {
  try {
    await db.raw('SELECT 1');
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  }
}

module.exports = {
  db,
  encrypt,
  decrypt,
  initializeDatabase,
  checkDatabaseHealth
};
