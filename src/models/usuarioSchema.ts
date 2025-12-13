/**
 * usuarioSchema.ts - Modelo de usuario con autenticación tradicional y Google OAuth.
 * Incluye datos personales, académicos, perfil, intereses y estado de cuenta (activo/inactivo).
 */

import { Schema, model } from 'mongoose';

const usuarioSchema = new Schema({
  nombre: { type: String, required: true, trim: true },
  apellido: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { 
    type: String, 
    required: function(this: any) {
      return this.authProvider === 'email';
    }, 
    select: false 
  },
  authProvider: { 
    type: String, 
    enum: ['email', 'google'], 
    default: 'email',
    required: true 
  },
  googleId: { 
    type: String, 
    unique: true, 
    sparse: true, 
    trim: true 
  },
  descripcion: { type: String, trim: true, maxlength: 300 },
  fotoPerfil: { 
    type: String, 
    trim: true, 
    default: '' 
  },
  activo: { type: Boolean, default: true },
  carrera: { type: String, required: true, trim: true },
  sede: { type: String, required: true, trim: true },
  edad: { type: Number, required: true },
  intereses: {
    type: [String],
    default: [],
    validate: {
      validator: function(v: string[]) {
        return v.length <= 5;
      },
      message: 'Máximo 5 intereses permitidos'
    }
  }
}, {
  timestamps: true
});

export const UsuarioModel = model('Usuario', usuarioSchema);
export default usuarioSchema;