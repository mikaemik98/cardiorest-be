import pool from '../database/db.js';

// Lisää uusi päiväkirjamerkintä tietokantaan
const createEntry = async (userId, entryData) => {
  console.log('createEntry input:', userId, entryData);
  const {entry_date, content, mood} = entryData;
  const dateOnly = entry_date.split('T')[0];
  const sql =
    'INSERT INTO diary_entries (user_id, entry_date, content, mood) VALUES (?, ?, ?, ?)';
  const params = [userId, dateOnly, content, mood || null];
  console.log('createEntry params:', params);
  try {
    const result = await pool.execute(sql, params);
    console.log('createEntry insertId:', result[0]?.insertId);
    return {id: result[0].insertId};
  } catch (e) {
    console.error('createEntry error:', e.message);
    return {error: e.message};
  }
};

// Hae käyttäjän kaikki päiväkirjamerkinnät (uusimmat ensin)
const getEntriesByUser = async (userId) => {
  const sql = `SELECT id, user_id, 
                 DATE_FORMAT(entry_date, '%Y-%m-%d') as entry_date,
                 content, mood, created_at 
                 FROM diary_entries WHERE user_id = ? ORDER BY entry_date DESC`;
  try {
    const [rows] = await pool.execute(sql, [userId]);
    console.log(`Found ${rows.length} diary entries for user ${userId}`);
    return rows;
  } catch (e) {
    console.error('getEntriesByUser error:', e.message);
    return [];
  }
};

// Hae yksittäinen päiväkirjamerkintä ID:n perusteella
const getEntryById = async (id, userId) => {
  const sql = `SELECT id, user_id,
                 DATE_FORMAT(entry_date, '%Y-%m-%d') as entry_date,
                 content, mood, created_at
                 FROM diary_entries WHERE id = ? AND user_id = ?`;
  try {
    const [rows] = await pool.execute(sql, [id, userId]);
    return rows[0] || null;
  } catch (e) {
    console.error('getEntryById error:', e.message);
    return null;
  }
};

// Päivitä päiväkirjamerkintää
const updateEntry = async (id, userId, updates) => {
  // Vain nämä kentät saa päivittää
  const allowedFields = ['entry_date', 'content', 'mood'];
  const updateFields = Object.keys(updates).filter((key) =>
    allowedFields.includes(key),
  );

  if (updateFields.length === 0) {
    return {error: 'Ei päivitettäviä kenttiä'};
  }

  // Rakennetaan SQL-kysely dynaamisesti
  let sql = 'UPDATE diary_entries SET ';
  const params = [];
  updateFields.forEach((field, index) => {
    sql += `${field} = ?`;
    if (index < updateFields.length - 1) sql += ', ';
    params.push(updates[field]);
  });
  sql += ' WHERE id = ? AND user_id = ?';
  params.push(id, userId);

  console.log('updateEntry SQL:', sql);
  console.log('updateEntry params:', params);

  try {
    const [result] = await pool.execute(sql, params);
    if (result.affectedRows === 0) {
      return {error: 'Merkintää ei löytynyt tai ei oikeutta päivittää'};
    }
    return {success: true};
  } catch (e) {
    console.error('updateEntry error:', e.message);
    return {error: e.message};
  }
};

// Poista päiväkirjamerkintä
const deleteEntry = async (id, userId) => {
  const sql = 'DELETE FROM diary_entries WHERE id = ? AND user_id = ?';
  try {
    const [result] = await pool.execute(sql, [id, userId]);
    if (result.affectedRows === 0) {
      return {error: 'Merkintää ei löytynyt tai ei oikeutta poistaa'};
    }
    console.log(`Deleted diary entry ${id} for user ${userId}`);
    return {success: true};
  } catch (e) {
    console.error('deleteEntry error:', e.message);
    return {error: e.message};
  }
};

export {createEntry, getEntriesByUser, getEntryById, updateEntry, deleteEntry};
