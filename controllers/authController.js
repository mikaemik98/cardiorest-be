import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {findUserByEmail, addUser} from '../models/User.js';


// POST /api/auth/register
const postRegister = async (req, res) => {
  const {name, email, password, role} = req.body;
  // Tarkistetaan pakolliset kentät
  if (!name || !email || !password || !role) {
    return res.status(400).json({error: 'Kaikki kentät ovat pakollisia (name, email, password, role)'});
  }
  if (!['patient', 'professional'].includes(role)) {
    return res.status(400).json({error: 'Rooli täytyy olla patient tai professional'});
  }
  // Tarkistetaan onko sähköposti jo käytössä
  const existing = await findUserByEmail(email);
  if (existing) {
    return res.status(409).json({error: 'Sähköposti on jo käytössä'});
  }
  // Hashataan salasana
  const hash = await bcrypt.hash(password, 10);
  // Tallennetaan käyttäjä
  const result = await addUser({name, email, password: hash, role});
  if (result.error) {
    return res.status(500).json({error: result.error});
  }
  res.status(201).json({message: 'Rekisteröinti onnistui', user_id: result.user_id});
};

// POST /api/auth/login
const postLogin = async (req, res) => {
  const {email, password} = req.body;
 
  // Tarkistetaan pakolliset kentät
  if (!email || !password) {
    return res.status(400).json({error: 'Sähköposti ja salasana ovat pakollisia'});
  }
  // Haetaan käyttäjä sähköpostin perusteella
  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(401).json({error: 'Väärä sähköposti tai salasana'});
  }
  // Verrataan salasanaa
  const passwordCorrect = await bcrypt.compare(password, user.password_hash);
  if (!passwordCorrect) {
    return res.status(401).json({error: 'Väärä sähköposti tai salasana'});
  }
  // Poistetaan salasana vastauksesta
  const {password_hash, ...userWithoutPassword} = user;
  // Luodaan JWT token
  const token = jwt.sign(
    {id: user.id, role: user.role},
    process.env.JWT_SECRET,
    {expiresIn: process.env.JWT_EXPIRES_IN},
  );
 
  res.json({message: 'Kirjautuminen onnistui', user: userWithoutPassword, token});
};
 
export {postRegister, postLogin};