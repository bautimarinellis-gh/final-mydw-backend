import { Server } from 'socket.io';
import { AuthenticatedSocket, EnviarMensajePayload, MensajeNuevoPayload, ClientToServerEvents, ServerToClientEvents } from '../types/socket';
import { MessageModel } from '../models/messageSchema';
import { MatchModel } from '../models/matchSchema';

// Helper: Validar que existe match activo entre dos usuarios (reutilizado de chatController)
async function validarMatch(userId: string, matchId: string, otroUsuarioId: string): Promise<boolean> {
  const match = await MatchModel.findById(matchId);
  
  if (!match) return false;
  if (match.estado !== 'activo') return false;
  
  // Verificar que el usuario es parte del match
  const esUsuario1 = match.usuario1Id.toString() === userId;
  const esUsuario2 = match.usuario2Id.toString() === userId;
  if (!esUsuario1 && !esUsuario2) return false;
  
  // Verificar que el otro usuario es la otra parte del match
  const otroEsUsuario1 = match.usuario1Id.toString() === otroUsuarioId;
  const otroEsUsuario2 = match.usuario2Id.toString() === otroUsuarioId;
  if (!otroEsUsuario1 && !otroEsUsuario2) return false;
  
  return true;
}

// Mapa para rastrear usuarios conectados: userId -> socketId
const usuariosConectados = new Map<string, string>();

export function setupSocketHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;
    
    if (!userId) {
      console.warn('[Socket] Conexión rechazada: usuario no autenticado');
      socket.disconnect();
      return;
    }

    // Registrar usuario conectado
    usuariosConectados.set(userId, socket.id);
    console.log(`[Socket] Usuario conectado: ${userId} (socket: ${socket.id})`);

    // Unirse a rooms de matches activos del usuario
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
      console.log(`[Socket] Usuario ${userId} unido a ${matches.length} conversaciones`);
    }).catch(error => {
      console.error(`[Socket] Error al obtener matches para ${userId}:`, error);
    });

    // Handler para enviar mensaje
    socket.on('mensaje:enviar', async (payload: EnviarMensajePayload, callback) => {
      try {
        // Validar que el usuario está autenticado
        if (!userId) {
          callback({ success: false, error: 'No autenticado' });
          return;
        }

        const { matchId, destinatarioId, contenido } = payload;

        // Validaciones básicas
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

        // Validar que existe match activo
        const matchValido = await validarMatch(userId, matchId, destinatarioId);
        if (!matchValido) {
          callback({ success: false, error: 'No tienes permiso para enviar mensajes en esta conversación' });
          return;
        }

        // Crear mensaje en BD
        const nuevoMensaje = await MessageModel.create({
          remitenteId: userId,
          destinatarioId,
          matchId,
          contenido: contenido.trim(),
          leido: false
        });

        // Preparar payload para emitir
        const mensajePayload: MensajeNuevoPayload = {
          id: nuevoMensaje._id.toString(),
          contenido: nuevoMensaje.contenido,
          remitenteId: nuevoMensaje.remitenteId.toString(),
          destinatarioId: nuevoMensaje.destinatarioId.toString(),
          matchId: nuevoMensaje.matchId.toString(),
          leido: nuevoMensaje.leido,
          createdAt: nuevoMensaje.createdAt
        };

        // Emitir al destinatario si está conectado
        const destinatarioSocketId = usuariosConectados.get(destinatarioId);
        if (destinatarioSocketId) {
          io.to(destinatarioSocketId).emit('mensaje:nuevo', mensajePayload);
          console.log(`[Socket] Mensaje enviado de ${userId} a ${destinatarioId} (conectado)`);
        } else {
          console.log(`[Socket] Mensaje enviado de ${userId} a ${destinatarioId} (no conectado)`);
        }

        // También emitir en el room del match para sincronización
        io.to(`match:${matchId}`).emit('mensaje:nuevo', mensajePayload);

        // Confirmar al remitente
        callback({ success: true, mensaje: mensajePayload });

      } catch (error) {
        console.error('[Socket] Error en mensaje:enviar:', error);
        callback({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Error interno del servidor' 
        });
      }
    });

    // Manejar desconexión
    socket.on('disconnect', () => {
      usuariosConectados.delete(userId);
      console.log(`[Socket] Usuario desconectado: ${userId} (socket: ${socket.id})`);
    });
  });
}

