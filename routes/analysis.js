import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { syncKubiosData, getUserAnalyses } from '../controllers/analysisController.js';

const router = express.Router();

// POST — hakee Kubioksesta ja tallentaa tietokantaan (vaatii kubios-loginin!)
router.post('/sync', authMiddleware, syncKubiosData);

// GET — hakee tallennetut analyysit tietokannasta
router.get('/', authMiddleware, getUserAnalyses);

export default router;