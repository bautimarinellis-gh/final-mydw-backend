import { Schema, model } from 'mongoose';

const usuarioSchema = new Schema({
  nombre: { type: String, required: true, trim: true },
  apellido: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  descripcion: { type: String, trim: true },
  carrera: { type: String, required: true, trim: true },
  sede: { type: String, required: true, trim: true },
  edad: { type: Number, required: true },
  intereses: { type: [String], default: [] },
  refreshTokens: { type: [String], default: [], select: false }
}, {
  timestamps: true
});

export const UsuarioModel = model('Usuario', usuarioSchema);
export default usuarioSchema;