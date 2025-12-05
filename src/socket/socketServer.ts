import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket, ClientToServerEvents, ServerToClientEvents } from '../types/socket';
import { verifyAccessToken } from '../services/tokenService';

export function initializeSocketIO(httpServer: HTTPServer, allowedOrigins: string[]): SocketIOServer<ClientToServerEvents, ServerToClientEvents> {
  const io = new SocketIOServer(httpServer, {
    transports: ['websocket'], // Forzar solo WebSocket puro
    cors: {
      origin: (origin, callback) => {
        // Permite requests sin origen (como móvil apps)
        if (!origin) {
          return callback(null, true);
        }
        
        // En desarrollo, permite cualquier localhost
        if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
          return callback(null, true);
        }
        
        // En producción, verifica contra la lista de orígenes permitidos
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.warn(`[Socket] Origen no permitido: ${origin}`);
          callback(new Error('No permitido por CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  // Middleware de autenticación
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      // Intentar obtener token de query string (funciona con WebSocket puro)
      const tokenFromQuery = socket.handshake.query.token as string | undefined;
      
      // Intentar obtener token de headers Authorization (fallback)
      const authHeader = socket.handshake.headers.authorization;
      const tokenFromHeader = authHeader?.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : undefined;

      const token = tokenFromQuery || tokenFromHeader;

      if (!token) {
        console.warn('[Socket] Conexión rechazada: token no proporcionado', {
          hasQueryToken: !!tokenFromQuery,
          hasHeaderToken: !!tokenFromHeader,
          query: socket.handshake.query,
        });
        return next(new Error('Token de acceso no proporcionado'));
      }

      // Verificar token
      const payload = verifyAccessToken(token);
      const userId = payload.sub;

      if (!userId) {
        console.warn('[Socket] Conexión rechazada: userId no encontrado en token');
        return next(new Error('Token inválido: userId no encontrado'));
      }

      // Asociar userId al socket
      socket.data = { userId };
      
      console.log(`[Socket] Usuario autenticado: ${userId} (transporte: ${socket.conn.transport.name})`);
      next();
    } catch (error) {
      console.warn('[Socket] Conexión rechazada: token inválido o expirado', error);
      const isExpired = error instanceof Error && 
        (error.message.includes('expired') || error.message.includes('jwt expired'));
      
      return next(new Error(isExpired ? 'Token de acceso expirado' : 'Token de acceso inválido'));
    }
  });

  return io;
}

