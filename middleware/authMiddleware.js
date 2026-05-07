// Koodissa hyödynnetty tekoälyä Claude Sonnet v4.6 koodin rakentamiseen ja tarkistamiseen, sekä ymmärtämiseen

import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Tarkistetaan että Authorization-otsikko on olemassa ja oikeassa muodossa
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({error: 'Ei tokenia. Anna authorization header Bearer <token>'});
  }
  // Poistetaan "Bearer " tokenin alusta
  const token = authHeader.substring(7);
  try {
    // Vahvistetaan token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Tallennetaan käyttäjätieto
    req.user = decoded;
    next();
  } catch (error) {
    // Token on virheellinen
    return res.status(401).json({error: 'Virheellinen token'});
  }
};

export default authMiddleware;