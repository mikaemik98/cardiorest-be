import pool from '../database/db.js';

// Haetaan käyttäjä sähköpostin perusteella
const findUserByEmail = async (email) => {
  const sql = 'SELECT * FROM users WHERE email = ?';
  try {
    const [rows] = await pool.execute(sql, [email]);
    return rows[0] || null;
  } catch (e) {
    console.error('findUserByEmail error:', e.message);
    return null;
  }
};

// Lisätään uusi käyttäjä
const addUser = async (user) => {
  const {name, email, password, role} = user;
  const sql = 'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)';
  try {
    const [result] = await pool.execute(sql, [name, email, password, role]);
    return {user_id: result.insertId};
  } catch (e) {
    console.error('addUser error:', e.message);
    return {error: e.message};
  }
};

export {findUserByEmail, addUser};