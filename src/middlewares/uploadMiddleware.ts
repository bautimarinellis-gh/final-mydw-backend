import { Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Crear carpeta uploads/images si no existe
const uploadsDir = path.join(process.cwd(), 'uploads', 'images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    // Generar nombre único: UUID + extensión original
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

// Filtro de validación de archivos
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Validar tipo MIME
  // Nota: image/jpeg es el tipo MIME estándar, pero algunos navegadores pueden reportar image/jpg
  const allowedMimes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/jpg'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PNG, SVG y JPG/JPEG'));
  }
};

// Configuración de multer
export const uploadProfileImage = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB en bytes
  },
  fileFilter: fileFilter,
});

// Exportar la ruta del directorio de uploads
export const UPLOADS_DIR = uploadsDir;

