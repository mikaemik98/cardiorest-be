import {
  createEntry,
  getEntriesByUser,
  getEntryById,
  updateEntry,
  deleteEntry,
} from '../models/DiaryEntry.js';

// POST /api/diary - Luo uusi päiväkirjamerkintä
const createDiaryEntry = async (req, res) => {
  console.log('createDiaryEntry request body:', req.body);
  const {entry_date, content, mood} = req.body;

  // Tarkistetaan että pakolliset kentät on annettu
  if (!entry_date || !content) {
    return res
      .status(400)
      .json({error: 'Päivämäärä ja sisältö ovat pakollisia'});
  }

  // Haetaan käyttäjän ID tokenista (authMiddleware asettaa tämän)
  const userId = req.user.userId || req.user.id;
  console.log('Creating diary entry for user:', userId);

  // Tallennetaan tietokantaan
  const result = await createEntry(userId, {entry_date, content, mood});

  if (result.error) {
    return res.status(500).json({error: result.error});
  }

  res.status(201).json({message: 'Päiväkirjamerkintä luotu', id: result.id});
};

// GET /api/diary - Hae kaikki omat päiväkirjamerkinnät
const getAllEntries = async (req, res) => {
  const userId = req.user.userId || req.user.id;
  console.log('Getting all diary entries for user:', userId);

  const entries = await getEntriesByUser(userId);
  res.json({entries});
};

// GET /api/diary/:id - Hae yksittäinen päiväkirjamerkintä
const getSingleEntry = async (req, res) => {
  const {id} = req.params;
  const userId = req.user.userId || req.user.id;
  console.log(`Getting diary entry ${id} for user ${userId}`);

  const entry = await getEntryById(id, userId);

  if (!entry) {
    return res.status(404).json({error: 'Päiväkirjamerkintää ei löytynyt'});
  }

  res.json({entry});
};

// PATCH /api/diary/:id - Päivitä päiväkirjamerkintää
const updateDiaryEntry = async (req, res) => {
  const {id} = req.params;
  const userId = req.user.userId || req.user.id;
  const updates = req.body;

  console.log(`Updating diary entry ${id} for user ${userId}:`, updates);

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({error: 'Ei päivitettäviä tietoja'});
  }

  const result = await updateEntry(id, userId, updates);

  if (result.error) {
    return res.status(404).json({error: result.error});
  }

  res.json({message: 'Päiväkirjamerkintä päivitetty'});
};

// DELETE /api/diary/:id - Poista päiväkirjamerkintä
const deleteDiaryEntry = async (req, res) => {
  const {id} = req.params;
  const userId = req.user.userId || req.user.id;

  console.log(`Deleting diary entry ${id} for user ${userId}`);

  const result = await deleteEntry(id, userId);

  if (result.error) {
    return res.status(404).json({error: result.error});
  }

  res.json({message: 'Päiväkirjamerkintä poistettu'});
};

export {
  createDiaryEntry,
  getAllEntries,
  getSingleEntry,
  updateDiaryEntry,
  deleteDiaryEntry,
};
