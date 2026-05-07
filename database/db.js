// database/db.js
import mysql from "mysql2/promise";
import dotenv from "dotenv";

// Ladataan muuttujat .env-tiedostosta
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export default pool;
