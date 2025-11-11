import { Router } from 'express';
import { getConversaciones, getConversacion, enviarMensaje, marcarMensajesLeidos } from '../controllers/chatController';
import { verifyAccessTokenMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Todas las rutas de chat requieren autenticación
router.get('/conversaciones', verifyAccessTokenMiddleware, getConversaciones);
router.get('/conversacion/:matchId', verifyAccessTokenMiddleware, getConversacion);
router.post('/mensaje', verifyAccessTokenMiddleware, enviarMensaje);
router.put('/mensajes/leidos/:matchId', verifyAccessTokenMiddleware, marcarMensajesLeidos);

export default router;

