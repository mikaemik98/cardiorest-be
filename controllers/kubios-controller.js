import fetch from 'node-fetch';
import {v4 as uuidv4} from 'uuid';
import pool from '../database/db.js';
import fs from 'fs';
// import {customError} from '../middlewares/error-handler.js';

// Kubios API base URL should be set in .env
const baseUrl = process.env.KUBIOS_API_URI;

/**
 * Get user data from Kubios API example
 * TODO: Implement error handling
 * @async
 * @param {Request} req Request object including Kubios id token
 * @param {Response} res
 * @param {NextFunction} next
 */
const getUserData = async (req, res, next) => {
  const {kubiosIdToken} = req.user;
  const headers = new Headers();
  headers.append('User-Agent', process.env.KUBIOS_USER_AGENT);
  headers.append('Authorization', kubiosIdToken);

  const response = await fetch(
    // TODO: set the from date more sophisticated way
    // in this example, data from 1.1.2024 is requested and hardcoded in the URL,
    // but it should be dynamic based on for example request parameters or some other date handling logic
    baseUrl + '/result/self?from=2024-01-01T00%3A00%3A00%2B00%3A00',
    {
      method: 'GET',
      headers: headers,
    },
  );
  const results = await response.json();

  // Kubiokselta saatua dataa voi käsitellä (palvelipuolella) tässä
  // ennen responsen lähettämistä client-sovellukselle

  return res.json(results);
};

/**
 * Get user info from Kubios API example
 * TODO: Implement error handling
 * @async
 * @param {Request} req Request object including Kubios id token
 * @param {Response} res
 * @param {NextFunction} next
 */
const getUserInfo = async (req, res, next) => {
  const {kubiosIdToken} = req.user;
  const headers = new Headers();
  headers.append('User-Agent', process.env.KUBIOS_USER_AGENT);
  headers.append('Authorization', kubiosIdToken);

  const response = await fetch(baseUrl + '/user/self', {
    method: 'GET',
    headers: headers,
  });
  const userInfo = await response.json();
  return res.json(userInfo);
};

// kirjaudu KUBIOS_USERNAME_2 tunnuksilla
const loginUser2 = async () => {
  const csrf = uuidv4();
  const searchParams = new URLSearchParams();
  searchParams.set('username', process.env.KUBIOS_USERNAME_2);
  searchParams.set('password', process.env.KUBIOS_PASSWORD_2);
  searchParams.set('client_id', process.env.KUBIOS_CLIENT_ID);
  searchParams.set('redirect_uri', process.env.KUBIOS_REDIRECT_URI);
  searchParams.set('response_type', 'token');
  searchParams.set('access_type', 'openid');
  searchParams.set('_csrf', csrf);

  const response = await fetch(process.env.KUBIOS_LOGIN_URL, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Cookie: `XSRF-TOKEN=${csrf}`,
      'User-Agent': process.env.KUBIOS_USER_AGENT,
    },
    body: searchParams,
  });

  const location = response.headers.get('location');
  if (!location) throw new Error('loginUser2: location header puuttuu');
  if (location.includes('login?null'))
    throw new Error('loginUser2: väärät tunnukset');

  const hashPart = location.split('#')[1];
  const params = new URLSearchParams(hashPart);
  const idToken = params.get('id_token');
  if (!idToken) throw new Error('loginUser2: id_token puuttuu');

  return idToken;
};

const syncTimeVaryingData = async (req, res, next) => {
  try {
    const localUserId = req.user.userId;

    // 1. Kirjaudu Elsin tunnuksilla
    console.log('Kirjaudutaan KUBIOS_USERNAME_2 tunnuksilla');
    const idToken = await loginUser2();
    console.log('Login onnistui');

    // 2. Hae mittauslista
    const measRes = await fetch(
      baseUrl + '/measure/self/session?from=2024-01-01T00%3A00%3A00%2B00%3A00',
      {
        headers: {
          Authorization: idToken,
          'User-Agent': process.env.KUBIOS_USER_AGENT,
        },
      },
    );
    const measData = await measRes.json();
    console.log('Mittauksia löytyi:', measData.measures?.length ?? 0);

    if (!measData.measures?.length) {
      return res.status(404).json({error: 'Ei mittauksia saatavilla'});
    }

    // 3. Järjestä uusimmasta vanhimpaan ja ota viimeisin
    const sorted = measData.measures.sort(
      (a, b) => new Date(b.measured_timestamp) - new Date(a.measured_timestamp),
    );
    const latest = sorted[0];
    console.log('Viimeisin mittaus:', latest.measured_timestamp);
    console.log('measure_id:', latest.measure_id);

    // 4. Hae yksittäinen mittaus data_url:n saamiseksi
    const detailRes = await fetch(
      baseUrl + `/measure/self/session/${latest.measure_id}`,
      {
        headers: {
          Authorization: idToken,
          'User-Agent': process.env.KUBIOS_USER_AGENT,
        },
      },
    );
    const detailData = await detailRes.json();
    console.log('Detail status:', detailData.status);
    console.log(
      'detailData.measure:',
      JSON.stringify(detailData.measure, null, 2),
    );
    console.log(
      'channels:',
      JSON.stringify(detailData.measure?.channels, null, 2),
    );
    console.log(
      'Kaikki channels:',
      detailData.measure.channels.map((c) => ({
        type: c.type,
        has_data_url: !!c.data_url,
      })),
    );

    // 5. Hae RRI-kanavan data_url
    const rriChannel = detailData.measure?.channels?.find(
      (c) => c.type === 'PPI',
    );
    const dataUrl = rriChannel?.data_url;
    //console.log('data_url:', dataUrl ? dataUrl.substring(0, 60) : 'PUUTTUU');

    if (!dataUrl) {
      return res.status(404).json({error: 'RRI data_url puuttuu'});
    }

    // 6. Hae RRI-raakadata
    const rriRes = await fetch(dataUrl);
    const rriBuffer = await rriRes.arrayBuffer();
    const buffer = Buffer.from(rriBuffer);
    const rri = [];
    for (let i = 0; i < buffer.length - 1; i += 2) {
      rri.push(buffer.readUInt16LE(i));
    }
    console.log('RRI-arvoja:', rri.length);

    // 7. Hae analytics access token
    console.log('TOKEN_URL:', process.env.TOKEN_URL);
    const tokenRes = await fetch(process.env.TOKEN_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        client_id: process.env.KUBIOS_CLIENT_ID_2,
        client_secret: process.env.KUBIOS_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error('access_token puuttuu');
    console.log('Access token saatu');

    // 8. Aja timevarying-analyysi
    console.log('ANALYZE_URL:', process.env.ANALYZE_URL);
    const analyzeRes = await fetch(process.env.ANALYZE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Api-Key': process.env.KUBIOS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'RRI',
        data: rri,
        analysis: {
          type: 'timevarying',
          preferences: {
            tv_window: 60,
            tv_window_shift: 30,
            enable_noise_detection: true,
          },
        },
      }),
    });
    const analyzeData = await analyzeRes.json();
    console.log('Analyysi status:', analyzeData.status);
    console.log('Analyysi response status:', analyzeRes.status);
    console.log('Analyysi data:', JSON.stringify(analyzeData, null, 2));

    if (analyzeData.status !== 'ok') {
      return res
        .status(500)
        .json({error: 'Analyysi epäonnistui', details: analyzeData});
    }

    const tv = analyzeData.analysis;
    const timevaryingJson = {
      labels: tv.t_hr,
      hr: tv.hr,
      rmssd: tv.rmssd,
    };

    // Muunna aikaleima MariaDB-yhteensopivaksi
    const recordedAt = new Date(latest.measured_timestamp)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    console.log('recordedAt muunnettu:', recordedAt);

    // 9. Tallenna measurements-tauluun
    const [measResult] = await pool.query(
      'INSERT INTO measurements (user_id, recorded_at, duration_seconds, rri_data) VALUES (?, ?, ?, ?)',
      [
        localUserId,
        recordedAt,
        latest.duration_seconds ?? 0,
        JSON.stringify(rri),
      ],
    );
    const measurementId = measResult.insertId;

    // 10. Tallenna analyses-tauluun
    await pool.query(
      `INSERT INTO analyses (measurement_id, readiness, rmssd_ms, sdnn_ms, pns_index, sns_index,
             stress_index, mean_hr_bpm, artefact_level, timevarying_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        measurementId,
        latest.result?.readiness ?? null,
        latest.result?.rmssd_ms ?? null,
        latest.result?.sdnn_ms ?? null,
        latest.result?.pns_index ?? null,
        latest.result?.sns_index ?? null,
        latest.result?.stress_index ?? null,
        latest.result?.mean_hr_bpm ?? null,
        latest.result?.artefact_level ?? null,
        JSON.stringify(timevaryingJson),
      ],
    );

    console.log('Tallennettu tietokantaan, measurement_id:', measurementId);
    return res.status(201).json({
      message: 'Timevarying-data tallennettu',
      measurement_id: measurementId,
      recorded_at: latest.measured_timestamp,
    });
  } catch (err) {
    console.error('syncTimeVaryingData virhe:', err.message);
    return next(err);
  }
};

// hakee viimeisimmän timevarying-datan tietokannasta
const getTimevaryingData = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.timevarying_data, a.readiness, a.rmssd_ms, m.recorded_at
      FROM analyses a
      JOIN measurements m ON a.measurement_id = m.id
      WHERE a.timevarying_data IS NOT NULL
      ORDER BY m.recorded_at DESC
      LIMIT 1`,
    );

    if (!rows.length) {
      return res.status(404).json({error: 'Ei timevarying dataa saatavilla'});
    }

    const row = rows[0];
    const tv =
      typeof row.timevarying_data === 'string'
        ? JSON.parse(row.timevarying_data)
        : row.timevarying_data;

    return res.json({
      recorded_at: row.recorded_at,
      readiness: row.readiness,
      rmssd_ms: row.rmssd_ms,
      timevarying: tv,
    });
  } catch (err) {
    console.error('getTimevaryingData virhe:', err.message);
    return next(err);
  }
};

// sisäinen funktio jota voidaan kutsua suoraan ilman req/res
const syncTimevaryingDataInternal = async (localUserId) => {
  console.log('Kirjaudutaan KUBIOS_USERNAME_2 tunnuksilla');
  const idToken = await loginUser2();

  const measRes = await fetch(
    baseUrl + '/measure/self/session?from=2024-01-01T00%3A00%3A00%2B00%3A00',
    {
      headers: {
        Authorization: idToken,
        'User-Agent': process.env.KUBIOS_USER_AGENT,
      },
    },
  );

  const measData = await measRes.json();
  if (!measData.measures?.length) throw new Error('Ei mittauksia');

  const sorted = measData.measures.sort(
    (a, b) => new Date(b.measured_timestamp) - new Date(a.measured_timestamp),
  );

  const latest = sorted[0];

  const detailRes = await fetch(
    baseUrl + `/measure/self/session/${latest.measure_id}`,
    {
      headers: {
        Authorization: idToken,
        'User-Agent': process.env.KUBIOS_USER_AGENT,
      },
    },
  );
  const detailData = await detailRes.json();

  const ppiChannel = detailData.measure?.channels?.find(
    (c) => c.type === 'PPI',
  );
  const dataUrl = ppiChannel?.data_url;
  if (!dataUrl) throw new Error('data_url puuttuu');

  const rriRes = await fetch(dataUrl);
  const rriBuffer = await rriRes.arrayBuffer();
  const buffer = Buffer.from(rriBuffer);
  const rri = [];
  for (let i = 0; i < buffer.length - 1; i += 2) {
    rri.push(buffer.readUInt16LE(i));
  }

  const tokenRes = await fetch(process.env.TOKEN_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      client_id: process.env.KUBIOS_CLIENT_ID_2,
      client_secret: process.env.KUBIOS_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) throw new Error('access_token puuttuu');

  const analyzeRes = await fetch(process.env.ANALYZE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Api-Key': process.env.KUBIOS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'RRI',
      data: rri,
      analysis: {
        type: 'timevarying',
        preferences: {
          tv_window: 60,
          tv_window_shift: 30,
          enable_noise_detection: true,
        },
      },
    }),
  });
  const analyzeData = await analyzeRes.json();
  if (analyzeData.status !== 'ok') throw new Error('Analyysi epäonnistui');

  const tv = analyzeData.analysis;
  const timevaryingJson = {labels: tv.t_hr, hr: tv.hr, rmssd: tv.rmssd};

  const recordedAt = new Date(latest.measured_timestamp)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');

  const [measResult] = await pool.query(
    'INSERT INTO measurements (user_id, recorded_at, duration_seconds, rri_data) VALUES (?, ?, ?, ?)',
    [
      localUserId,
      recordedAt,
      latest.duration_seconds ?? 0,
      JSON.stringify(rri),
    ],
  );

  await pool.query(
    `INSERT INTO analyses (measurement_id, timevarying_data) VALUES (?, ?)`,
    [measResult.insertId, JSON.stringify(timevaryingJson)],
  );

  console.log('Timevarying tallennettu, measurement_id:', measResult.insertId);
};

export {
  getUserData,
  getUserInfo,
  syncTimeVaryingData,
  getTimevaryingData,
  syncTimevaryingDataInternal,
};
