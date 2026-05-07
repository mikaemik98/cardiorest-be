// Koodissa hyödynnetty tekoälyä Claude Sonnet v4.6 koodin rakentamiseen ja tarkistamiseen, sekä ymmärtämiseen

import pool from '../database/db.js';

// Tallentaa mittauksen ja palauttaa sen id:n
const saveMeasurement = async (user_id, recorded_at, duration_seconds, rri_data) => {
  const [result] = await pool.query(
    'INSERT INTO measurements (user_id, recorded_at, duration_seconds, rri_data) VALUES (?, ?, ?, ?)',
    [user_id, recorded_at, duration_seconds, JSON.stringify(rri_data)]
  );
  return result.insertId;
};

// Hakee kaikki käyttäjän mittaukset
const getMeasurementsByUser = async (user_id) => {
  const [rows] = await pool.query(
    'SELECT * FROM measurements WHERE user_id = ? ORDER BY recorded_at DESC',
    [user_id]
  );
  return rows;
};

export { saveMeasurement, getMeasurementsByUser };