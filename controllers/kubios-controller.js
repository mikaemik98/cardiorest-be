import fetch from 'node-fetch';
import {v4 as uuidv4} from 'uuid';
import pool from '../database/db.js';

const baseUrl = process.env.KUBIOS_API_URI;

/**
 * Hakee käyttäjän HRV-tulokset Kubios Cloud -palvelusta
 */
const getUserData = async (req, res, next) => {
  const {kubiosIdToken} = req.user;
  const headers = new Headers();
  headers.append('User-Agent', process.env.KUBIOS_USER_AGENT);
  headers.append('Authorization', kubiosIdToken);

  const response = await fetch(
    baseUrl + '/result/self?from=2024-01-01T00%3A00%3A00%2B00%3A00',
    {method: 'GET', headers},
  );
  return res.json(await response.json());
};

/**
 * Hakee käyttäjän profiilin Kubios Cloud -palvelusta
 */
const getUserInfo = async (req, res, next) => {
  const {kubiosIdToken} = req.user;
  const headers = new Headers();
  headers.append('User-Agent', process.env.KUBIOS_USER_AGENT);
  headers.append('Authorization', kubiosIdToken);

  const response = await fetch(baseUrl + '/user/self', {
    method: 'GET',
    headers,
  });
  return res.json(await response.json());
};

/**
 * Kirjautuu Kubios-palveluun KUBIOS_USERNAME_2 tunnuksilla
 * ja palauttaa id_token -tunnisteen
 */
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

  const params = new URLSearchParams(location.split('#')[1]);
  const idToken = params.get('id_token');
  if (!idToken) throw new Error('loginUser2: id_token puuttuu');

  return idToken;
};

/**
 * Synkronoi time-varying HRV-datan Kubios Cloud -palvelusta tietokantaan.
 * Hakee kovakoodatun TARGET_MEASURE_ID -mittauksen PPI/RRI-raakadatan,
 * ajaa Kubios Analytics -analyysin ja tallentaa tuloksen.
 * HUOM: TARGET_MEASURE_ID on tilapäinen ratkaisu — korvaa dynaamisella logiikalla.
 */
const syncTimeVaryingData = async (req, res, next) => {
  try {
    const localUserId = req.user.userId;

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

    if (!measData.measures?.length) {
      return res.status(404).json({error: 'Ei mittauksia saatavilla'});
    }

    // Haetaan kovakoodattu yönyli mittaus
    // TODO: korvata dynaamisella logiikalla joka hakee pisimmän mittauksen
    const TARGET_MEASURE_ID = '48a15014-3f47-44f6-bb86-cf450f757399';
    const latest = measData.measures.find(
      (m) => m.measure_id === TARGET_MEASURE_ID,
    );
    if (!latest) return res.status(404).json({error: 'Mittausta ei löydy'});

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

    const rriChannel = detailData.measure?.channels?.find(
      (c) => c.type === 'RRI' || c.type === 'PPI',
    );
    const dataUrl = rriChannel?.data_url;
    if (!dataUrl) return res.status(404).json({error: 'RRI data_url puuttuu'});

    // Pura PPI/RRI binääridata
    const rriBuffer = await (await fetch(dataUrl)).arrayBuffer();
    const buffer = Buffer.from(rriBuffer);
    const rri = [];
    for (let i = 0; i < buffer.length - 1; i += 2) {
      rri.push(buffer.readUInt16LE(i));
    }

    // Hae Kubios Analytics access token
    const tokenData = await (
      await fetch(process.env.TOKEN_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
          client_id: process.env.KUBIOS_CLIENT_ID_2,
          client_secret: process.env.KUBIOS_CLIENT_SECRET,
          grant_type: 'client_credentials',
        }),
      })
    ).json();

    if (!tokenData.access_token) throw new Error('access_token puuttuu');

    // Aja time-varying analyysi (60s ikkuna, 30s siirto)
    const analyzeRes = await fetch(process.env.ANALYZE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
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

    // Kubios palauttaa NaN-arvoja — korvataan null:lla ennen JSON-parsintaa
    const analyzeData = JSON.parse(
      (await analyzeRes.text()).replace(/\bNaN\b/g, 'null'),
    );
    if (analyzeData.status !== 'ok') {
      return res
        .status(500)
        .json({error: 'Analyysi epäonnistui', details: analyzeData});
    }

    const tv = analyzeData.analysis;
    const timevaryingJson = {labels: tv.t_hr, hr: tv.hr, rmssd: tv.rmssd};

    // Säilytä alkuperäinen aikavyöhyke — ei muunneta UTC:hen
    const recordedAt = latest.measured_timestamp.replace('T', ' ').slice(0, 19);

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
      `INSERT INTO analyses (measurement_id, readiness, rmssd_ms, sdnn_ms, pns_index, sns_index,
       stress_index, mean_hr_bpm, artefact_level, timevarying_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        measResult.insertId,
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

    return res.status(201).json({
      message: 'Timevarying-data tallennettu',
      measurement_id: measResult.insertId,
      recorded_at: latest.measured_timestamp,
    });
  } catch (err) {
    console.error('syncTimeVaryingData virhe:', err.message);
    return next(err);
  }
};

/**
 * Hakee viimeisimmän time-varying HRV-analyysin tietokannasta
 */
const getTimevaryingData = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.timevarying_data, a.readiness, a.rmssd_ms,
     DATE_FORMAT(m.recorded_at, '%Y-%m-%dT%H:%i:%s') as recorded_at
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

    const recordedAt =
      row.recorded_at instanceof Date
        ? row.recorded_at.toISOString().slice(0, 19)
        : String(row.recorded_at).replace(' ', 'T');

    return res.json({
      recorded_at: recordedAt,
      readiness: row.readiness,
      rmssd_ms: row.rmssd_ms,
      timevarying: tv,
    });
  } catch (err) {
    console.error('getTimevaryingData virhe:', err.message);
    return next(err);
  }
};

/**
 * Sisäinen funktio jota kutsutaan automaattisesti kun Elsi kirjautuu.
 * Synkronoi time-varying HRV-datan ilman req/res-objekteja.
 * HUOM: TARGET_MEASURE_ID on tilapäinen ratkaisu.
 */
const syncTimevaryingDataInternal = async (localUserId) => {
  // Tarkista onko jo tänään synkronoitu
  const [existing] = await pool.query(
    `SELECT id FROM measurements 
     WHERE user_id = ? AND DATE(recorded_at) = CURDATE()
     ORDER BY recorded_at DESC LIMIT 1`,
    [localUserId],
  );
  if (existing.length > 0) {
    console.log('Tänään jo synkronoitu, ohitetaan');
    return;
  }

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

  // Haetaan kovakoodattu yönyli mittaus
  // TODO: korvata dynaamisella logiikalla
  const TARGET_MEASURE_ID = '48a15014-3f47-44f6-bb86-cf450f757399';
  const latest = measData.measures.find(
    (m) => m.measure_id === TARGET_MEASURE_ID,
  );
  if (!latest) throw new Error('Mittausta ei löydy');

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
    (c) => c.type === 'PPI' || c.type === 'RRI',
  );
  if (!ppiChannel?.data_url) throw new Error('data_url puuttuu');

  const rriBuffer = await (await fetch(ppiChannel.data_url)).arrayBuffer();
  const buffer = Buffer.from(rriBuffer);
  const rri = [];
  for (let i = 0; i < buffer.length - 1; i += 2) {
    rri.push(buffer.readUInt16LE(i));
  }

  const tokenData = await (
    await fetch(process.env.TOKEN_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        client_id: process.env.KUBIOS_CLIENT_ID_2,
        client_secret: process.env.KUBIOS_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    })
  ).json();
  if (!tokenData.access_token) throw new Error('access_token puuttuu');

  const analyzeRes = await fetch(process.env.ANALYZE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
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

  const analyzeData = JSON.parse(
    (await analyzeRes.text()).replace(/\bNaN\b/g, 'null'),
  );
  if (analyzeData.status !== 'ok') throw new Error('Analyysi epäonnistui');

  const tv = analyzeData.analysis;
  const timevaryingJson = {labels: tv.t_hr, hr: tv.hr, rmssd: tv.rmssd};

  const recordedAt = latest.measured_timestamp.replace('T', ' ').slice(0, 19);

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
