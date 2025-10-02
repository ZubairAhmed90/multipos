const mysql = require('mysql2/promise');
const https = require('https');

let pool;

const getPublicIP = () => {
  return new Promise((resolve, reject) => {
    https
      .get('https://api.ipify.org?format=json', (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const ip = JSON.parse(data).ip;
            resolve(ip);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
};

// MySQL configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'multipos_db',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  idleTimeout: 600000, // 10 minutes
  keepAliveInitialDelay: 0,
  enableKeepAlive: true,
  // Additional connection options
  charset: 'utf8mb4',
  timezone: 'Z',
  supportBigNumbers: true,
  bigNumberStrings: true,
};

// Create connection pool
pool = mysql.createPool(dbConfig);

// Enhanced database operation wrapper with retry logic
const executeWithRetry = async (query, params = [], retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // MySQL execution
      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {

      // Retry only on connection issues
      if (
        (error.code === 'ECONNRESET' ||
          error.code === 'PROTOCOL_CONNECTION_LOST' ||
          error.code === 'ETIMEDOUT') &&
        attempt < retries
      ) {
        console.log(
          `Retrying database query in 2000ms... (attempt ${
            attempt + 1
          }/${retries})`
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      throw error;
    }
  }
};

// Enhanced pool.execute wrapper
const executeQuery = async (query, params = []) => {
  return executeWithRetry(query, params);
};

// Test database connection
const connectDB = async () => {
  try {
    // Test MySQL connection
    const connection = await pool.getConnection();
    console.log('✅ MySQL database connected successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);

    // Show the current public IP so user can add to cPanel Remote MySQL
    try {
      const ip = await getPublicIP();
      console.log(
        `⚠️  Add this IP to your cPanel "Remote MySQL": ${ip}`
      );
    } catch (ipErr) {
      console.error('Could not fetch public IP:', ipErr.message);
    }

    console.log(
      '⚠️  Continuing without database connection for testing purposes'
    );
  }
};

// Graceful shutdown
const closeDB = async () => {
  try {
    await pool.end();
    console.log('MySQL database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error.message);
  }
};

module.exports = {
  pool,
  connectDB,
  closeDB,
  executeQuery,
  executeWithRetry,
};
