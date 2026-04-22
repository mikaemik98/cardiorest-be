import {Router} from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  createDiaryEntry,
  getAllEntries,
  getSingleEntry,
  updateDiaryEntry,
  deleteDiaryEntry,
} from '../controllers/diaryController.js';

const router = Router();

// Kaikki päiväkirjan reitit vaativat kirjautumisen (authMiddleware tarkistaa tokenin)
router.post('/', authMiddleware, createDiaryEntry); // Luo uusi merkintä
router.get('/', authMiddleware, getAllEntries); // Hae kaikki merkinnät
router.get('/:id', authMiddleware, getSingleEntry); // Hae yksi merkintä
router.patch('/:id', authMiddleware, updateDiaryEntry); // Päivitä merkintää
router.delete('/:id', authMiddleware, deleteDiaryEntry); // Poista merkintä

export default router;
