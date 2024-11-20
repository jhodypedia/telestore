// db.js
const mysql = require('mysql2');

// Koneksi MySQL
const db = mysql.createConnection({
  host: 'localhost',    // Ganti dengan host MySQL Anda
  user: 'root',         // Ganti dengan username MySQL Anda
  password: '',         // Ganti dengan password MySQL Anda
  database: 'bottele',    // Ganti dengan nama database Anda
});

// Cek koneksi
db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to MySQL database');
});

module.exports = db;
