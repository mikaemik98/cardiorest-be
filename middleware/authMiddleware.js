import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Ei tokenia. Anna authorization header Bearer <token>' });
  }

  const token = authHeader.substring(7);
  try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('authMiddleware decoded:', decoded);
  req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Virheellinen token' });
  }
};

export default authMiddleware;

