import { Router } from 'express';
import { getNextProfile, swipe, getMatches } from '../controllers/discoverController';
import { verifyAccessTokenMiddleware, verifyUserActiveMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Rutas protegidas (requieren autenticación)
router.get('/next', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, getNextProfile);
router.post('/swipe', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, swipe);
router.get('/matches', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, getMatches);

export default router;

