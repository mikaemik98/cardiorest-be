// Koodissa hyödynnetty tekoälyä Claude Sonnet v4.6 koodin rakentamiseen ja tarkistamiseen, sekä ymmärtämiseen

import fetch from 'node-fetch';
import {v4 as uuidv4} from 'uuid';
import pool from '../database/db.js';
import fs from 'fs';

const baseUrl = process.env.KUBIOS_API_URI;

/**
 * Hakee käyttäjän mittaustulokset Kubios APIsta
 * @async
 * @param {Request} req - Pyyntöobjekti, sisältää Kubios id-tokenin
 * @param {Response} res
 * @param {NextFunction} next
 */
const getUserData = async (req, res, next) => {
  const {kubiosIdToken} = req.user;
  const headers = new Headers();
  headers.append('User-Agent', process.env.KUBIOS_USER_AGENT);
  headers.append('Authorization', kubiosIdToken);

  // Haetaan tulokset 1.1.2024 alkaen
  const response = await fetch(
    baseUrl + '/result/self?from=2024-01-01T00%3A00%3A00%2B00%3A00',
    {method: 'GET', headers},
  );
  const results = await response.json();
  return res.json(results);
};

/**
 * Hakee kirjautuneen käyttäjän perustiedot Kubios APIsta
 * @async
 * @param {Request} req - Pyyntöobjekti, sisältää Kubios id-tokenin
 * @param {Response} res
 * @param {NextFunction} next
 */
const getUserInfo = async (req, res, next) => {
  const {kubiosIdToken} = req.user;
  const headers = new Headers();
  headers.append('User-Agent', process.env.KUBIOS_USER_AGENT);
  headers.append('Authorization', kubiosIdToken);

  const response = await fetch(baseUrl + '/user/self', {method: 'GET', headers});
  const userInfo = await response.json();
  return res.json(userInfo);
};

/**
 * Kirjautuu Kubioseen KUBIOS_USERNAME_2 tunnuksilla
 * Käytetään sisäisesti datan synkronointiin
 * @async
 * @return {string} Kubiosin id-token
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
  if (location.includes('login?null')) throw new Error('loginUser2: väärät tunnukset');

  // Tokenit palautetaan URL:n hash-osassa
  const hashPart = location.split('#')[1];
  const params = new URLSearchParams(hashPart);
  const idToken = params.get('id_token');
  if (!idToken) throw new Error('loginUser2: id_token puuttuu');

  return idToken;
};

/**
 * HTTP-reittikäsittelijä: hakee viimeisimmän mittauksen, ajaa timevarying-analyysin
 * ja tallentaa tulokset tietokantaan
 * @async
 * @param {Request} req - Pyyntöobjekti, sisältää kirjautuneen käyttäjän id:n
 * @param {Response} res
 * @param {NextFunction} next
 */
const syncTimeVaryingData = async (req, res, next) => {
  try {
    const localUserId = req.user.userId;

    // 1. Kirjaudu Kubioseen Elsin tunnuksilla
    const idToken = await loginUser2();
    console.log('Login onnistui');

    // 2. Hae mittauslista
    const measRes = await fetch(
      baseUrl + '/measure/self/session?from=2024-01-01T00%3A00%3A00%2B00%3A00',
      {headers: {Authorization: idToken, 'User-Agent': process.env.KUBIOS_USER_AGENT}},
    );
    const measData = await measRes.json();
    console.log('Mittauksia löytyi:', measData.measures?.length ?? 0);

    if (!measData.measures?.length) {
      return res.status(404).json({error: 'Ei mittauksia saatavilla'});
    }

    // 3. Järjestä uusimmasta vanhimpaan, ota viimeisin
    const latest = measData.measures.sort(
      (a, b) => new Date(b.measured_timestamp) - new Date(a.measured_timestamp),
    )[0];
    console.log('Viimeisin mittaus:', latest.measured_timestamp, '| measure_id:', latest.measure_id);

    // 4. Hae yksittäisen mittauksen tiedot (sisältää data_url:n)
    const detailRes = await fetch(
      baseUrl + `/measure/self/session/${latest.measure_id}`,
      {headers: {Authorization: idToken, 'User-Agent': process.env.KUBIOS_USER_AGENT}},
    );
    const detailData = await detailRes.json();

    // 5. Etsi PPI-kanava ja hae sen data_url
    const rriChannel = detailData.measure?.channels?.find((c) => c.type === 'PPI');
    const dataUrl = rriChannel?.data_url;
    if (!dataUrl) {
      return res.status(404).json({error: 'RRI data_url puuttuu'});
    }

    // 6. Hae RRI-raakadata binäärimuodossa ja muunna taulukoksi
    const rriBuffer = await (await fetch(dataUrl)).arrayBuffer();
    const buffer = Buffer.from(rriBuffer);
    const rri = [];
    for (let i = 0; i < buffer.length - 1; i += 2) {
      rri.push(buffer.readUInt16LE(i)); // 16-bittinen little-endian
    }
    console.log('RRI-arvoja:', rri.length);

    // 7. Hae analytics-palvelun access token client credentials -virralla
    const tokenRes = await fetch(process.env.TOKEN_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        client_id: process.env.KUBIOS_CLIENT_ID_2,
        client_secret: process.env.KUBIOS_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    });
    const {access_token: accessToken} = await tokenRes.json();
    if (!accessToken) throw new Error('access_token puuttuu');

    // 8. Aja timevarying HRV -analyysi RRI-datalle
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
            tv_window: 60,        // Ikkunan koko sekunteina
            tv_window_shift: 30,  // Ikkunan siirto sekunteina
            enable_noise_detection: true,
          },
        },
      }),
    });
    const analyzeData = await analyzeRes.json();

    if (analyzeData.status !== 'ok') {
      return res.status(500).json({error: 'Analyysi epäonnistui', details: analyzeData});
    }

    // 9. Poimitaan tarvittavat kentät analyysituloksesta
    const tv = analyzeData.analysis;
    const timevaryingJson = {labels: tv.t_hr, hr: tv.hr, rmssd: tv.rmssd};

    // Muunna aikaleima MariaDB-yhteensopivaksi (ISO → 'YYYY-MM-DD HH:MM:SS')
    const recordedAt = new Date(latest.measured_timestamp)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    // 10. Tallenna mittaus tietokantaan
    const [measResult] = await pool.query(
      'INSERT INTO measurements (user_id, recorded_at, duration_seconds, rri_data) VALUES (?, ?, ?, ?)',
      [localUserId, recordedAt, latest.duration_seconds ?? 0, JSON.stringify(rri)],
    );
    const measurementId = measResult.insertId;

    // 11. Tallenna analyysi tietokantaan
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

/**
 * Hakee viimeisimmän timevarying-analyysin tietokannasta
 * @async
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
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
    // Parsitaan JSON jos tietokanta palautti merkkijonon
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

/**
 * Sisäinen versio syncTimeVaryingData-funktiosta ilman HTTP req/res-objekteja.
 * Kutsutaan suoraan esim. kirjautumisen yhteydessä (auth-controller).
 * @async
 * @param {number} localUserId - Paikallisen tietokannan käyttäjä-id
 */
const syncTimevaryingDataInternal = async (localUserId) => {
  // Kirjaudu ja hae mittauslista
  const idToken = await loginUser2();
  const measRes = await fetch(
    baseUrl + '/measure/self/session?from=2024-01-01T00%3A00%3A00%2B00%3A00',
    {headers: {Authorization: idToken, 'User-Agent': process.env.KUBIOS_USER_AGENT}},
  );
  const measData = await measRes.json();
  if (!measData.measures?.length) throw new Error('Ei mittauksia');

  // Ota viimeisin mittaus
  const latest = measData.measures.sort(
    (a, b) => new Date(b.measured_timestamp) - new Date(a.measured_timestamp),
  )[0];

  // Hae PPI-kanavan data_url
  const detailData = await (
    await fetch(baseUrl + `/measure/self/session/${latest.measure_id}`, {
      headers: {Authorization: idToken, 'User-Agent': process.env.KUBIOS_USER_AGENT},
    })
  ).json();

  const dataUrl = detailData.measure?.channels?.find((c) => c.type === 'PPI')?.data_url;
  if (!dataUrl) throw new Error('data_url puuttuu');

  // Hae ja pursa RRI-raakadata
  const buffer = Buffer.from(await (await fetch(dataUrl)).arrayBuffer());
  const rri = [];
  for (let i = 0; i < buffer.length - 1; i += 2) {
    rri.push(buffer.readUInt16LE(i));
  }

  // Hae access token analytiikkapalveluun
  const {access_token: accessToken} = await (
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
  if (!accessToken) throw new Error('access_token puuttuu');

  // Aja timevarying-analyysi
  const analyzeData = await (
    await fetch(process.env.ANALYZE_URL, {
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
          preferences: {tv_window: 60, tv_window_shift: 30, enable_noise_detection: true},
        },
      }),
    })
  ).json();
  if (analyzeData.status !== 'ok') throw new Error('Analyysi epäonnistui');

  const tv = analyzeData.analysis;
  const timevaryingJson = {labels: tv.t_hr, hr: tv.hr, rmssd: tv.rmssd};

  // Muunna aikaleima ja tallenna tietokantaan
  const recordedAt = new Date(latest.measured_timestamp)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');

  const [measResult] = await pool.query(
    'INSERT INTO measurements (user_id, recorded_at, duration_seconds, rri_data) VALUES (?, ?, ?, ?)',
    [localUserId, recordedAt, latest.duration_seconds ?? 0, JSON.stringify(rri)],
  );

  await pool.query(
    'INSERT INTO analyses (measurement_id, timevarying_data) VALUES (?, ?)',
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