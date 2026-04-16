import fetch from 'node-fetch';
import { saveMeasurement } from '../models/Measurement.js';
import { saveAnalysis } from '../models/Analysis.js';

// Hakee Kubios-datan ja tallentaa sen tietokantaan
const syncKubiosData = async (req, res) => {
  try {
    const kubiosToken = req.user.kubiosIdToken;
    const user_id = req.user.userId;

    // Haetaan mittaukset Kubios API:sta
    const response = await fetch(`${process.env.KUBIOS_API_URI}/user/self/measurement`, {
      headers: {
        'Authorization': kubiosToken,
        'User-Agent': process.env.KUBIOS_USER_AGENT
      }
    });

    const data = await response.json();
    
    // Tulostetaan Kubiosin vastaus terminaaliin debuggausta varten
    console.log('Kubios vastaus status:', data.status);
    console.log('Kubios vastaus:', JSON.stringify(data, null, 2));

    if (data.status !== 'ok') {
      return res.status(500).json({ error: 'Kubios-datan haku epäonnistui', kubios_response: data });
    }

    const results = [];

    // Tallennetaan jokainen mittaus tietokantaan
    for (const measurement of data.measurements) {
      const measurement_id = await saveMeasurement(
        user_id,
        measurement.recorded_at,
        measurement.duration_seconds,
        measurement.rri_data
      );

      // Jos mittauksella on analyysi, tallennetaan sekin
      if (measurement.analysis) {
        await saveAnalysis(measurement_id, measurement.analysis);
      }

      results.push({ measurement_id });
    }

    res.status(201).json({ 
      message: `${results.length} mittausta tallennettu!`, 
      results 
    });
  } catch (err) {
    // Tulostetaan virhe terminaaliin
    console.error('syncKubiosData virhe:', err);
    res.status(500).json({ error: err.message });
  }
};

// Hakee käyttäjän tallennetut mittaukset + analyysit tietokannasta
const getUserAnalyses = async (req, res) => {
  try {
    const user_id = req.user.userId;
    const [rows] = await (await import('../database/db.js')).default.query(
      `SELECT m.recorded_at, m.duration_seconds, a.* 
       FROM measurements m 
       LEFT JOIN analyses a ON m.id = a.measurement_id 
       WHERE m.user_id = ? 
       ORDER BY m.recorded_at DESC`,
      [user_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('getUserAnalyses virhe:', err);
    res.status(500).json({ error: err.message });
  }
};

export { syncKubiosData, getUserAnalyses };