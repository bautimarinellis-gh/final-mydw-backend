/**
 * messageSchema.ts - Modelo de mensajes del chat entre usuarios con match.
 * Almacena contenido de mensajes, estado de lectura y referencias a remitente/destinatario.
 */

import { Schema, model } from 'mongoose';

const messageSchema = new Schema({
  remitenteId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  destinatarioId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
  contenido: { type: String, required: true, maxlength: 1000, trim: true },
  leido: { type: Boolean, default: false }
}, {
  timestamps: true
});

messageSchema.index({ matchId: 1, createdAt: -1 });

export const MessageModel = model('Message', messageSchema);
export default messageSchema;

