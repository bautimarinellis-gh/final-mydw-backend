import { Router } from 'express';
import { register, login, refresh, logout, me, getUsuarios } from '../controllers/usuarioController';
import { verifyAccessTokenMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Rutas públicas
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Rutas protegidas
router.get('/me', verifyAccessTokenMiddleware, me);
router.get('/usuarios', verifyAccessTokenMiddleware, getUsuarios);

export default router;

