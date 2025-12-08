/**
 * socket.d.ts - Definiciones de tipos para Socket.IO y eventos de WebSocket.
 * Incluye interfaces de eventos cliente-servidor, payloads de mensajes y socket autenticado.
 */

import { Socket } from 'socket.io';

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

export interface ClientToServerEvents {
  'mensaje:enviar': (payload: EnviarMensajePayload, callback: (response: { success: boolean; mensaje?: MensajeNuevoPayload; error?: string }) => void) => void;
}

export interface ServerToClientEvents {
  'mensaje:nuevo': (mensaje: MensajeNuevoPayload) => void;
}

export interface AuthenticatedSocket extends Socket<ClientToServerEvents, ServerToClientEvents> {
  data: {
    userId: string;
  };
}

