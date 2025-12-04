import { Router } from 'express';
import { verifyAccessTokenMiddleware, verifyUserActiveMiddleware } from '../middlewares/authMiddleware';
import { getNextProfile, swipe, getMatches, getFilteredProfiles, getFilterOptions, getLikeHistory } from '../controllers/discoverController';

const router = Router();

// Rutas protegidas (requieren autenticación)
router.get('/next', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, getNextProfile);
router.post('/swipe', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, swipe);
router.get('/matches', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, getMatches);
router.get('/filter', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, getFilteredProfiles);
router.get('/filters', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, getFilterOptions);
router.get('/likes', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, getLikeHistory);

export default router;