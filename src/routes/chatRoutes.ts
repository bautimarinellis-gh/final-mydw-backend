/**
 * chatRoutes.ts - Rutas de chat y mensajería en tiempo real.
 * Gestiona conversaciones, mensajes, lectura de mensajes y sincronización entre usuarios con match activo.
 */

import { Router } from 'express';
import { getConversaciones, getConversacion, enviarMensaje, marcarMensajesLeidos } from '../controllers/chatController';
import { verifyAccessTokenMiddleware, verifyUserActiveMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/conversaciones', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, getConversaciones);
router.get('/conversacion/:matchId', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, getConversacion);
router.post('/mensaje', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, enviarMensaje);
router.put('/mensajes/leidos/:matchId', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, marcarMensajesLeidos);

export default router;

