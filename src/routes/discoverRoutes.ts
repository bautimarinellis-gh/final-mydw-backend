import { Router } from 'express';
import { getNextProfile, swipe, getMatches } from '../controllers/discoverController';
import { verifyAccessTokenMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Todas las rutas de discover requieren autenticación
router.get('/next', verifyAccessTokenMiddleware, getNextProfile);
router.post('/swipe', verifyAccessTokenMiddleware, swipe);
router.get('/matches', verifyAccessTokenMiddleware, getMatches);

export default router;

