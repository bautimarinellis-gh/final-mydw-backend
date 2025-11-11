import { Schema, model } from 'mongoose';

const matchSchema = new Schema({
  usuario1Id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  usuario2Id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  estado: { type: String, enum: ['activo', 'bloqueado'], default: 'activo' }
}, {
  timestamps: true
});

// Índice compuesto para evitar duplicados y búsquedas rápidas
matchSchema.index({ usuario1Id: 1, usuario2Id: 1 }, { unique: true });

export const MatchModel = model('Match', matchSchema);
export default matchSchema;

