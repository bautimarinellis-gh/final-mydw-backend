import { Router } from 'express';
import { getConversaciones, getConversacion, enviarMensaje, marcarMensajesLeidos } from '../controllers/chatController';
import { verifyAccessTokenMiddleware, verifyUserActiveMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Todas las rutas de chat requieren autenticación y que el usuario esté activo
router.get('/conversaciones', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, getConversaciones);
router.get('/conversacion/:matchId', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, getConversacion);
router.post('/mensaje', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, enviarMensaje);
router.put('/mensajes/leidos/:matchId', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, marcarMensajesLeidos);

export default router;

