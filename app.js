// Koodissa hyödynnetty tekoälyä Claude Sonnet v4.6 koodin rakentamiseen ja tarkistamiseen, sekä ymmärtämiseen

// app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import kubiosRouter from './routes/kubios.js';
import diaryRouter from './routes/diary.js';
import analysisRouter from './routes/analysis.js';

// Ladataan .env 
dotenv.config();

const hostname = '127.0.0.1';
const app = express();
const PORT = process.env.PORT || 3000;

// Sallitaan CORS kaikilta domaineilta
app.use(cors());
// Parsitaan JSON-muotoiset pyyntöjen bodyt automaattisesti
app.use(express.json());

// Reititys
app.use('/api/auth', authRouter);       // Kirjautuminen ja rekisteröinti
app.use('/api/users', userRouter);      // Käyttäjähallinta
app.use('/api/kubios', kubiosRouter);   // Kubios API -integraatio
app.use('/api/diary', diaryRouter);     // Päiväkirjamerkinnät
app.use('/api/analyses', analysisRouter); // HRV-analyysit

// Testataan että palvelin toimii
app.get('/', (req, res) => {
  res.json({message: 'CardioRest backend toimii'});
});

// Käynnistetään palvelin
app.listen(PORT, hostname, () => {
  console.log(`Palvelin käynnissä portissa http://${hostname}:${PORT}/`);
});
