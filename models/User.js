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
  console.log('addUser input:', user);
  const {name, password_hash, email, role = 'patient'} = user;
  const sql = `INSERT INTO users (name, password_hash, email, role) VALUES (?, ?, ?, ?)`;
  const params = [name, password_hash, email, role];
  console.log('addUser params:', params);
  try {
    const result = await pool.execute(sql, params);
    console.log('addUser result full:', JSON.stringify(result));
    console.log('addUser insertId:', result[0]?.insertId);
    return {user_id: result[0].insertId};
  } catch (e) {
    console.error('addUser error:', e);
    return {error: e.message};
  }
};

// Haetaan käyttäjä ID:n perusteella (ilman salasanaa)
const getUserById = async (id) => {
  const sql = 'SELECT id, name, email, role, created_at FROM users WHERE id = ?';
  try {
    const [rows] = await pool.execute(sql, [id]);
    return rows[0] || null;
  } catch (e) {
    console.error('getUserById error:', e.message);
    return null;
  }
};

// Päivitetään käyttäjän tietoja (ei roolia tai salasanaa tähän)
const updateUser = async (id, updates) => {
  const allowedFields = ['name', 'email'];
  const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));
  if (updateFields.length === 0) {
    return {error: 'Ei päivitettäviä kenttiä (name tai email)'};
  }

  let sql = 'UPDATE users SET ';
  const params = [];
  updateFields.forEach((field, index) => {
    sql += `${field} = ?, `;
    params.push(updates[field]);
  });
  sql = sql.slice(0, -2) + ' WHERE id = ?';
  params.push(id);

  // Tarkista email unique jos muutetaan
  const currentUser = await getUserById(id);
  if (updates.email && updates.email !== currentUser?.email) {
    const existing = await findUserByEmail(updates.email);
    if (existing && existing.id !== id) {
      return {error: 'Sähköposti on jo käytössä toisella käyttäjällä'};
    }
  }

  try {
    const [result] = await pool.execute(sql, params);
    if (result.affectedRows === 0) {
      return {error: 'Käyttäjää ei löytynyt tai ei muutoksia'};
    }
    return {success: true};
  } catch (e) {
    console.error('updateUser error:', e.message);
    return {error: e.message};
  }
};

// Poistetaan käyttäjä ID:n perusteella
const deleteUser = async (id) => {
  const sql = 'DELETE FROM users WHERE id = ?';
  try {
    const [result] = await pool.execute(sql, [id]);
    if (result.affectedRows === 0) {
      return {error: 'Käyttäjää ei löytynyt'};
    }
    return {success: true};
  } catch (e) {
    console.error('deleteUser error:', e.message);
    return {error: e.message};
  }
};

 const selectUserByEmail = async (email) => {
   try {
     const sql = 'SELECT * FROM users WHERE email=?';
     const params = [email];
     const [rows] = await pool.execute(sql, params);
     // console.log(rows);
     // if nothing is found with the user id, result array is empty []
     if (rows.length === 0) {
       return {error: 404, message: 'user not found'};
     }
     // Remove password property from result
     delete rows[0].password;
     return rows[0];
   } catch (error) {
     console.error('selectUserByEmail', error);
     return {error: 500, message: 'db error'};
   }
 };

export {findUserByEmail, addUser, getUserById, updateUser, deleteUser, selectUserByEmail};
