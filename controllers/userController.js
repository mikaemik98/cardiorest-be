import {getUserById, updateUser, deleteUser} from '../models/User.js';

// GET /api/users/profile - hae omat tiedot
const getProfile = async (req, res) => {
  console.log('getProfile req.user:', req.user);
  const userId = req.user.userId || req.user.id;
  console.log('getProfile using userId:', userId);
  const user = await getUserById(userId);
  if (!user) {
    return res.status(404).json({error: 'Käyttäjää ei löytynyt'});
  }
  res.json({user, kubios_token: req.user.kubiosIdToken});
};

// PATCH /api/users/profile - päivitä omat tiedot
const updateProfile = async (req, res) => {
  const updates = req.body;
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({error: 'Ei päivitettäviä tietoja'});
  }
  const result = await updateUser(req.user.userId, updates);
  if (result.error) {
    return res.status(result.error.includes('käytössä') ? 409 : 400).json({error: result.error});
  }
  // Hae päivitetty
  const updatedUser = await getUserById(req.user.userId);
  res.json({message: 'Tiedot päivitetty', user: updatedUser});
};

// DELETE /api/users/profile - poista oma tili
const deleteAccount = async (req, res) => {
  const result = await deleteUser(req.user.userId);
  if (result.error) {
    return res.status(404).json({error: result.error});
  }
  res.json({message: 'Tili poistettu pysyvästi'});
};

export {getProfile, updateProfile, deleteAccount};

