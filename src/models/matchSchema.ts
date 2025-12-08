/**
 * matchSchema.ts - Modelo de matches confirmados entre usuarios.
 * Representa conexiones mutuas (like recíproco) con estado activo o bloqueado.
 */

import { Schema, model } from 'mongoose';

const matchSchema = new Schema({
  usuario1Id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  usuario2Id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  estado: { type: String, enum: ['activo', 'bloqueado'], default: 'activo' }
}, {
  timestamps: true
});

matchSchema.index({ usuario1Id: 1, usuario2Id: 1 }, { unique: true });

export const MatchModel = model('Match', matchSchema);
export default matchSchema;

