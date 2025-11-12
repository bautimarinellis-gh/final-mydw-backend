import { Router } from 'express';
import { getNextProfile, swipe, getMatches } from '../controllers/discoverController';
import { verifyAccessTokenMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Ruta pública para obtener perfiles (SIN autenticación)
router.get('/next', getNextProfile);

// Rutas protegidas (requieren autenticación)
router.post('/swipe', verifyAccessTokenMiddleware, swipe);
router.get('/matches', verifyAccessTokenMiddleware, getMatches);

export default router;

