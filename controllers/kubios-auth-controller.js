// Koodissa hyödynnetty tekoälyä Claude Sonnet v4.6 koodin rakentamiseen ja tarkistamiseen, sekä ymmärtämiseen

/**
 * Autentikointikontrolleri, joka käyttää Kubios APIa kirjautumiseen
 * @module controllers/auth-controller
 * @exports postLogin
 * @exports getMe
 */

// Tulostaa kirjautumis-URL:n debuggausta varten
console.log('LOGIN URL:', process.env.KUBIOS_LOGIN_URL);

// Kirjastojen importit
import jwt from 'jsonwebtoken'; // JWT-tokenien luomiseen ja vahvistamiseen
import fetch from 'node-fetch'; // HTTP-pyyntöjen tekemiseen
import {v4} from 'uuid'; // Yksilöllisten tunnisteiden luomiseen (CSRF-token, salasana)
import {addUser, selectUserByEmail} from '../models/User.js'; // Käyttäjätietokantaoperaatiot

// Kubios API:n perusosoite ympäristömuuttujasta
const baseUrl = process.env.KUBIOS_API_URI;

/**
 * Luo POST-kirjautumispyynnön Kubios APIin
 * @async
 * @param {string} username Käyttäjänimi Kubiosissa
 * @param {string} password Salasana Kubiosissa
 * @return {string} Kubiosin id-token
 */
const kubiosLogin = async (username, password) => {
  // Luodaan CSRF-token väärennöksiltä suojautumiseen
  const csrf = v4();
  // Rakennetaan HTTP-otsikot
  const headers = new Headers();
  // Asetetaan CSRF-token evästeeksi palvelimelle
  headers.append('Cookie', `XSRF-TOKEN=${csrf}`);
  // Asetetaan selaintunniste (User-Agent) ympäristömuuttujasta
  headers.append('User-Agent', process.env.KUBIOS_USER_AGENT);
  // Rakennetaan lomakedata URL-enkoodattuun muotoon
  const searchParams = new URLSearchParams();
  searchParams.set('username', username);
  searchParams.set('password', password);
  searchParams.set('client_id', process.env.KUBIOS_CLIENT_ID); // Sovelluksen tunniste
  searchParams.set('redirect_uri', process.env.KUBIOS_REDIRECT_URI); // Uudelleenohjausosoite onnistumisen jälkeen
  searchParams.set('response_type', 'token'); // Pyydetään token-vastaus
  searchParams.set('access_type', 'openid'); // OpenID Connect -tyyppi
  searchParams.set('_csrf', csrf); // CSRF-suojaustoken lomakkeessa

  // Fetch-pyynnön asetukset
  const options = {
    method: 'POST', // Kirjautuminen on POST-pyyntö
    headers: headers,
    redirect: 'manual', // Estetään automaattinen uudelleenohjaus, jotta saadaan location-otsikko
    body: searchParams,
  };
  let response;
  try {
    // Lähetetään kirjautumispyyntö Kubios-palvelimelle
    response = await fetch(process.env.KUBIOS_LOGIN_URL, options);
  } catch (err) {
    // Verkkovirhe tai muu fetch-tason ongelma
    console.error('Kubios login error', err);
    throw new Error('Login with Kubios failed');
  }
  // Haetaan redirect-osoite vastauksesta – Kubios palauttaa tokenit URL:n hash-osassa
  const location = response.headers.get('location');
  // Epäonnistunut kirjautuminen: Kubios ohjaa takaisin kirjautumissivulle parametrilla "null"
  if (location.includes('login?null')) {
    throw new Error('Login with Kubios failed due bad username/password');
  }
  // Onnistunut kirjautuminen: URL sisältää tokenit query-parametreina
  // Esimerkki: ...#id_token=xxx&access_token=yyy&expires_in=zzz
  const regex = /id_token=(.*)&access_token=(.*)&expires_in=(.*)/;
  // Erotellaan tokenit regexillä
  const match = location.match(regex);
  // Otetaan talteen vain id_token, jota käytetään jatkossa
  const idToken = match[1];
  return idToken;
};

/**
 * Haetaan kirjautuneen käyttäjän tiedot Kubios APIsta
 * @async
 * @param {string} idToken Kubios id token
 * @return {object} user Käyttäjän tiedot
 */
const kubiosUserInfo = async (idToken) => {
  const headers = new Headers();
  // Lisätään selaintunniste
  headers.append('User-Agent', process.env.KUBIOS_USER_AGENT);
  // Lisätään id-token autentoinnille Authorization-otsikkoon
  headers.append('Authorization', idToken);
  // Haetaan käyttäjän omat tiedot Kubios API:sta
  const response = await fetch(baseUrl + '/user/self', {
    method: 'GET',
    headers: headers,
  });
  // Muutetaan vastaus JavaScript-objektiksi
  const responseJson = await response.json();
  // Palautetaan käyttäjätiedot jos API vastasi onnistuneesti
  if (responseJson.status === 'ok') {
    return responseJson.user;
  } else {
    throw new Error('Kubios user info failed');
  }
};

/**
 * Synkronoi Kubios-käyttäjän paikalliseen tietokantaan
 * Jos käyttäjää ei löydy sähköpostin perusteella, luodaan uusi.
 * Jos löytyy, käytetään olemassa olevaa.
 * @async
 * @param {object} kubiosUser Kubiosin palauttamat käyttäjätiedot
 * @return {number} userId Paikallisen tietokannan käyttäjä-id
 */
const syncWithLocalUser = async (kubiosUser) => {
  let userId;
  // Etsitään käyttäjä paikallisesta tietokannasta sähköpostiosoitteen perusteella
  const result = await selectUserByEmail(kubiosUser.email);
  console.log('selectUserByEmail result:', result);

  if (result.error) {
    // Jos käyttäjää ei löydy, luodaan uusi paikallinen käyttäjä
    const newUser = {
      name: kubiosUser.email,
      email: kubiosUser.email,
      // Satunnainen salasana pakollisen kentän täyttämiseksi
      password_hash: v4(),
      role: 'patient', // Oletusrooli uusille käyttäjille
    };

    const newUserResult = await addUser(newUser);

    if (newUserResult.user_id) {
      userId = newUserResult.user_id;
    } else {
      // Käyttäjän luominen epäonnistui
      console.error('addUser failed:', newUserResult);
    }
  } else {
    // Käyttäjä löytyi tietokannasta, käytetään olemassa olevaa id:tä
    userId = result.id;
    console.log('Using existing userId:', userId);
  }

  console.log('syncWithLocalUser userId', userId);
  return userId;
};

/**
 * Käyttäjän kirjautuminen – HTTP POST -käsittelijä
 * Kirjautuu Kubiosin kautta, hakee käyttäjätiedot ja luo paikallisen JWT-tokenin
 * @async
 * @param {object} req - Express-pyyntöobjekti (body: { username, password })
 * @param {object} res - Express-vastausobjekti
 * @param {function} next - Express-virheenkäsittelijä
 * @return {object} JSON-vastaus: käyttäjätiedot ja JWT-token
 */
const postLogin = async (req, res, next) => {
  const {username, password} = req.body;
  console.log('Login attempt username:', username);
  console.log('Login attempt password length:', password?.length);

  try {
    // Vaihe 1: Kirjaudutaan Kubiosin kautta ja saadaan id-token
    const kubiosIdToken = await kubiosLogin(username, password);

    // Vaihe 2: Haetaan käyttäjän tiedot Kubios API:sta id-tokenilla
    const kubiosUser = await kubiosUserInfo(kubiosIdToken);

    // Vaihe 3: Synkronoidaan käyttäjä paikalliseen tietokantaan
    const localUserId = await syncWithLocalUser(kubiosUser);
    console.log('localUserId after sync:', localUserId);

    // Varmistetaan että paikallinen käyttäjä-id saatiin
    if (!localUserId) {
      return res
        .status(500)
        .json({error: 'Local user sync failed, userId undefined'});
    }

    // Luodaan sovelluksen oma JWT-token, johon sisällytetään myös Kubiosin id-token
    // Tämä mahdollistaa Kubios API -kutsujen tekemisen myöhemmin ilman uutta kirjautumista
    const token = jwt.sign(
      {userId: localUserId, kubiosIdToken: kubiosIdToken},
      process.env.JWT_SECRET, // Allekirjoitusavain
      {
        expiresIn: process.env.JWT_EXPIRES_IN, // Tokenin voimassaoloaika
      },
    );

    // Erityistapaus: jos Elsi (testikäyttäjä) kirjautuu, synkronoidaan hänen mittausdatansa
    if (username === process.env.KUBIOS_USERNAME_2) {
      console.log('Elsi kirjautui, synkronoidaan timevarying data');
      try {
        // Dynaaminen import välttää sirkularisen riippuvuuden
        const {syncTimevaryingDataInternal} =
          await import('./kubios-controller.js');
        await syncTimevaryingDataInternal(localUserId);
        console.log('Timevarying data synkronoitu');
      } catch (syncErr) {
        // Synkronointivirhe ei kaada kirjautumista – kirjataan virhe lokiin
        console.error('Timevarying synkronointi epäonnistui:', syncErr.message);
      }
    }

    // Palautetaan onnistunut vastaus käyttäjätiedoilla ja tokenilla
    return res.json({
      message: 'Logged in successfully with Kubios',
      user: kubiosUser, // Kubiosin palauttamat käyttäjätiedot
      user_id: localUserId, // Paikallinen käyttäjä-id
      token, // JWT-token asiakkaalle tallennettavaksi
    });
  } catch (err) {
    // Välitetään virhe Expressin virheenkäsittelijälle
    console.error('Kubios login error', err);
    return next(err);
  }
};

/**
 * Hakee kirjautuneen käyttäjän tiedot JWT-tokenin perusteella
 * @async
 * @param {object} req - Express-pyyntöobjekti (req.user sisältää dekoodatun tokenin)
 * @param {object} res - Express-vastausobjekti
 * @return {object} JSON-vastaus: käyttäjätiedot ja Kubios-token
 */
const getMe = async (req, res) => {
  // Huom: getUserById-funktiota ei ole importoitu – tässä on bugi!
  const user = await getUserById(req.user.userId);
  // Palautetaan käyttäjätiedot ja Kubiosin token (esim. suoria Kubios API -kutsuja varten)
  res.json({user, kubios_token: req.user.kubiosIdToken});
};

export {postLogin, getMe};
