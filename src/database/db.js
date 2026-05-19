const mysql = require("mysql2");
require("dotenv").config();

// Membuat connection pool untuk efisiensi koneksi
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "warnet_billing",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Mengubah pool agar mendukung Promise (async/await)
const db = pool.promise();

module.exports = db;
