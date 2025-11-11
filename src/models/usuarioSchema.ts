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