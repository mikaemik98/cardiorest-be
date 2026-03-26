# CardioRest BE - Backend
HUOM! Readme tehty Claude tekoälyn avulla
CardioRest on terveystietokeskus, joka keräää ja analysoi sydämen vaihtelutietoja (HRV) Kubiosin API:n kautta.

## Tekniikat
- **Node.js / Express** - Backend framework
- **Sequelize** - ORM ja tietokanta-mallit
- **JWT (JSON Web Tokens)** - Käyttäjän autentikointi
- **Kubios API** - HRV ja terveystietojen haku
- **CORS** - Cross-Origin Resource Sharing

## Asennus ja käynnistys
1. `npm install` - Asenna riippuvuudet
2. Aseta `.env` tiedosto (DB_URL, JWT_SECRET, Kubios kredentiaalit)
3. `node init-db.js` - Alusta tietokanta
4. `npm start` - Käynnistä palvelin (portti 3000)

---

##  API Endpointit

### Autentikointi (Authentication)
Nämä endpointit eivät vaadi token-autentikointia.

| Metodi | Endpoint | Kuvaus | Pyynnön data |
|--------|----------|--------|--------------|
| **POST** | `/api/auth/register` | Rekisteröidy uusiksi käyttäjäksi | `{ email, password, name }` |
| **POST** | `/api/auth/login` | Kirjaudu sisään | `{ email, password }` |

**Login-vastaus sisältää Bearer-tokenin:**
```json
{
  "token": "eyJhbGc...",
  "userId": 1
}
```

### Käyttäjäprofiili (Users) 
Kaikki nämä endpointit vaativat Bearer-tokenin headerissa: `Authorization: Bearer <token>`

| Metodi | Endpoint | Kuvaus |
|--------|----------|--------|
| **GET** | `/api/users/profile` | Hae oman profiilin tiedot |
| **PATCH** | `/api/users/profile` | Päivitä profiilitietoja (esim. nimi, sähköposti) |
| **DELETE** | `/api/users/profile` | Poista käyttäjätili (oikeudet poistuvat) |

### Kubios HRV-data 🫀 (Users) 
Nämä endpointit hakevat sydämen vaihtelutietoja Kubiosin API:sta. Vaativat Bearer-tokenin.

| Metodi | Endpoint | Kuvaus |
|--------|----------|--------|
| **GET** | `/api/kubios/user-data` | Hae käyttäjän HRV-mittaukset ja analyysit |
| **GET** | `/api/kubios/user-info` | Hae käyttäjän perustiedot Kubioksesta |

---

##  Kuinka kirjautuminen toimii

### 1. Rekisteröityminen
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "testi@example.com",
  "password": "salasana123",
  "name": "Testi Käyttäjä"
}
```

### 2. Kirjautuminen (Login)
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "testi@example.com",
  "password": "salasana123"
}
```

**Vastaus:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": 1
}
```

### 3. Tokenin käyttö
Jokaiseen turvattuun pyyntöön lisää token Authorization-headeriin:
```bash
GET /api/users/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

##  Kehitystyö

### Valmiit ominaisuudet
-  Käyttäjän rekisteröityminen (`POST /api/auth/register`)
-  Käyttäjän kirjautuminen (`POST /api/auth/login`)
-  Profiilin haku (`GET /api/users/profile`)
-  Profiilin päivitys (`PATCH /api/users/profile`)
-  Tilin poistaminen (`DELETE /api/users/profile`)
-  Kubios HRV-datan haku (`GET /api/kubios/user-data`)
-  Kubios käyttäjätietojen haku (`GET /api/kubios/user-info`)
-  JWT-autentikointi middleware

### Tänään tehty (26.3.2026)
-  Kaikki POST, GET ja DELETE reitit integroitu
-  Bearer token -autentikointi korjattu vertailun kanssa
-  Kubios datahaku integroitu
- Frontend test HTML luotu (`frontend/index.html`)
- README päivitetty täydellisellä dokumentaatiolla

---

##  Frontend testi (HTML)

### Sijainti
`frontend/index.html` - Testisivun frontend HRV-datan visualisointiin

### Kuinka käyttää
1. Avaa `frontend/index.html` selaimessa
2. Kirjaudu sisään backend-palvelun kautta (`POST /api/auth/login`)
3. Kopioi vastauksesta saatava **Bearer token**
4. Klikkaa "Hae uusimmat mittaukset" -nappia frontendissä
5. Liitä token kehotteeseen
6. Näet HRV-mittaukset kaavioina ja taulukkoina:
   -  Readiness-kaavio (viimeiset 20 mittausta)
   -  Recovery-kaavio (viimeiset 20 mittausta)
   -  Sydämenlyöntitiheys (HR bpm) -kuvaaja
   -  Yksityiskohtainen mittaustaulukko

**Esimerkki tokentin liittämisestä:**
- Kehotus: "Anna Bearer token (login:stä kopioitu):"
- Kirjoita: `eJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (pelkkä token ilman "Bearer"-sanaa)

### API-pyynnöt joita frontend käyttää
```bash
# Kirjautuminen
POST http://127.0.0.1:3000/api/auth/login
{ "email": "...", "password": "..." }

# HRV-datan haku (vaatii tokenin)
GET http://127.0.0.1:3000/api/kubios/user-data
Authorization: Bearer <token>
```

---

##  Testaaminen

Katso `test/test-requests.http` tiedosto REST-pyynnön esimerkeille.

