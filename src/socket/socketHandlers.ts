/**
 * socketHandlers.ts - Manejadores de eventos WebSocket para chat en tiempo real.
 * Gestiona conexiones, envío de mensajes, validación de matches y sincronización de rooms.
 */

import { Server } from 'socket.io';
import { AuthenticatedSocket, EnviarMensajePayload, MensajeNuevoPayload, ClientToServerEvents, ServerToClientEvents } from '../types/socket';
import { MessageModel } from '../models/messageSchema';
import { MatchModel } from '../models/matchSchema';

async function validarMatch(userId: string, matchId: string, otroUsuarioId: string): Promise<boolean> {
  const match = await MatchModel.findById(matchId);
  
  if (!match) return false;
  if (match.estado !== 'activo') return false;
  
  const esUsuario1 = match.usuario1Id.toString() === userId;
  const esUsuario2 = match.usuario2Id.toString() === userId;
  if (!esUsuario1 && !esUsuario2) return false;
  
  const otroEsUsuario1 = match.usuario1Id.toString() === otroUsuarioId;
  const otroEsUsuario2 = match.usuario2Id.toString() === otroUsuarioId;
  if (!otroEsUsuario1 && !otroEsUsuario2) return false;
  
  return true;
}

const usuariosConectados = new Map<string, string>();

let ioInstance: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

export function getIOInstance(): Server<ClientToServerEvents, ServerToClientEvents> | null {
  return ioInstance;
}

export function emitirMensajeNuevo(
  mensajePayload: MensajeNuevoPayload,
  destinatarioId: string,
  matchId: string
): void {
  if (!ioInstance) {
    console.warn('No hay instancia de io disponible para emitir mensaje');
    return;
  }
  
  const io = ioInstance;
  const destinatarioSocketId = usuariosConectados.get(destinatarioId);
  if (destinatarioSocketId) {
    io.to(destinatarioSocketId).emit('mensaje:nuevo', mensajePayload);
    console.log(`Mensaje emitido de ${mensajePayload.remitenteId} a ${destinatarioId} (conectado)`);
  } else {
    console.log(`Mensaje emitido de ${mensajePayload.remitenteId} a ${destinatarioId} (no conectado)`);
  }

  io.to(`match:${matchId}`).emit('mensaje:nuevo', mensajePayload);
}

export function setupSocketHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  ioInstance = io;
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;
    
    if (!userId) {
      console.warn('Conexión rechazada: usuario no autenticado');
      socket.disconnect();
      return;
    }

    usuariosConectados.set(userId, socket.id);
    console.log(`Usuario conectado: ${userId} (socket: ${socket.id})`);

    MatchModel.find({
      $or: [
        { usuario1Id: userId },
        { usuario2Id: userId }
      ],
      estado: 'activo'
    }).then(matches => {
      matches.forEach(match => {
        socket.join(`match:${match._id.toString()}`);
      });
      console.log(`Usuario ${userId} unido a ${matches.length} conversaciones`);
    }).catch(error => {
      console.error(`Error al obtener matches para ${userId}:`, error);
    });

    socket.on('mensaje:enviar', async (payload: EnviarMensajePayload, callback) => {
      try {
        if (!userId) {
          callback({ success: false, error: 'No autenticado' });
          return;
        }

        const { matchId, destinatarioId, contenido } = payload;

        if (!matchId || !destinatarioId || !contenido) {
          callback({ success: false, error: 'matchId, destinatarioId y contenido son requeridos' });
          return;
        }

        if (typeof contenido !== 'string' || contenido.trim() === '') {
          callback({ success: false, error: 'El contenido no puede estar vacío' });
          return;
        }

        if (contenido.length > 1000) {
          callback({ success: false, error: 'El mensaje no puede exceder 1000 caracteres' });
          return;
        }

        if (userId === destinatarioId) {
          callback({ success: false, error: 'No puedes enviarte mensajes a ti mismo' });
          return;
        }

        const matchValido = await validarMatch(userId, matchId, destinatarioId);
        if (!matchValido) {
          callback({ success: false, error: 'No tienes permiso para enviar mensajes en esta conversación' });
          return;
        }

        const nuevoMensaje = await MessageModel.create({
          remitenteId: userId,
          destinatarioId,
          matchId,
          contenido: contenido.trim(),
          leido: false
        });

        const mensajePayload: MensajeNuevoPayload = {
          id: nuevoMensaje._id.toString(),
          contenido: nuevoMensaje.contenido,
          remitenteId: nuevoMensaje.remitenteId.toString(),
          destinatarioId: nuevoMensaje.destinatarioId.toString(),
          matchId: nuevoMensaje.matchId.toString(),
          leido: nuevoMensaje.leido,
          createdAt: nuevoMensaje.createdAt
        };

        emitirMensajeNuevo(mensajePayload, destinatarioId, matchId);

        callback({ success: true, mensaje: mensajePayload });

      } catch (error) {
        console.error('Error en mensaje:enviar:', error);
        callback({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Error interno del servidor' 
        });
      }
    });

    socket.on('disconnect', () => {
      usuariosConectados.delete(userId);
      console.log(`Usuario desconectado: ${userId} (socket: ${socket.id})`);
    });
  });
}

