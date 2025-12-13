/**
 * socketServer.ts - Inicialización y configuración del servidor Socket.IO.
 * Configura CORS, autenticación JWT y transport WebSocket para chat en tiempo real.
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket, ClientToServerEvents, ServerToClientEvents } from '../types/socket';
import { verifyAccessToken } from '../services/tokenService';

export function initializeSocketIO(httpServer: HTTPServer, allowedOrigins: string[]): SocketIOServer<ClientToServerEvents, ServerToClientEvents> {
  const io = new SocketIOServer(httpServer, {
    transports: ['websocket'],
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }
        
        if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
          return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.warn(`Origen no permitido: ${origin}`);
          callback(new Error('No permitido por CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const tokenFromQuery = socket.handshake.query.token as string | undefined;
      
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
        console.warn('Conexión rechazada: userId no encontrado en token');
        return next(new Error('Token inválido: userId no encontrado'));
      }

      socket.data = { userId };
      
      console.log(`Usuario autenticado: ${userId} (transporte: ${socket.conn.transport.name})`);
      next();
    } catch (error) {
      console.warn('Conexión rechazada: token inválido o expirado', error);
      const isExpired = error instanceof Error && 
        (error.message.includes('expired') || error.message.includes('jwt expired'));
      
      return next(new Error(isExpired ? 'Token de acceso expirado' : 'Token de acceso inválido'));
    }
  });

  return io;
}

