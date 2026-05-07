// Koodissa hyödynnetty tekoälyä Claude Sonnet v4.6 koodin rakentamiseen ja tarkistamiseen, sekä ymmärtämiseen

import pool from '../database/db.js';

// Tallentaa analyysin tietokantaan
const saveAnalysis = async (measurement_id, data) => {
  const [result] = await pool.query(
    `INSERT INTO analyses 
      (measurement_id, readiness, rmssd_ms, sdnn_ms, pns_index, sns_index, 
       stress_index, mean_hr_bpm, artefact_level, timevarying_data, sleep_duration_h, sleep_score) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      measurement_id,
      data.readiness,
      data.rmssd_ms,
      data.sdnn_ms,
      data.pns_index,
      data.sns_index,
      data.stress_index,
      data.mean_hr_bpm,
      data.artefact_level,
      JSON.stringify(data.timevarying_data),
      data.sleep_duration_h,
      data.sleep_score
    ]
  );
  return result.insertId;
};

// Hakee analyysin mittauksen id:n perusteella
const getAnalysisByMeasurement = async (measurement_id) => {
  const [rows] = await pool.query(
    'SELECT * FROM analyses WHERE measurement_id = ?',
    [measurement_id]
  );
  return rows[0];
};

export { saveAnalysis, getAnalysisByMeasurement };