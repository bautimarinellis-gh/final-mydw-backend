/**
 * interactionSchema.ts - Modelo de interacciones de swipe entre usuarios.
 * Registra likes y dislikes con índice único para prevenir duplicados.
 */

import { Schema, model } from 'mongoose';

const interactionSchema = new Schema({
  usuarioId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  estudianteId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  tipo: { type: String, enum: ['like', 'dislike'], required: true }
}, {
  timestamps: true
});

interactionSchema.index({ usuarioId: 1, estudianteId: 1 }, { unique: true });

export const InteractionModel = model('Interaction', interactionSchema);
export default interactionSchema;

