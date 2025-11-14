import { Socket } from 'socket.io';

// Payload para enviar mensaje
export interface EnviarMensajePayload {
  matchId: string;
  destinatarioId: string;
  contenido: string;
}

// Payload para recibir nuevo mensaje
export interface MensajeNuevoPayload {
  id: string;
  contenido: string;
  remitenteId: string;
  destinatarioId: string;
  matchId: string;
  leido: boolean;
  createdAt: Date;
}

// Eventos del cliente al servidor
export interface ClientToServerEvents {
  'mensaje:enviar': (payload: EnviarMensajePayload, callback: (response: { success: boolean; mensaje?: MensajeNuevoPayload; error?: string }) => void) => void;
}

// Eventos del servidor al cliente
export interface ServerToClientEvents {
  'mensaje:nuevo': (mensaje: MensajeNuevoPayload) => void;
}

// Extender el tipo Socket para incluir userId autenticado
export interface AuthenticatedSocket extends Socket<ClientToServerEvents, ServerToClientEvents> {
  data: {
    userId: string;
  };
}

