/**
 * uploadMiddleware.ts - Middleware de Multer para subida de imágenes de perfil.
 * Configura validaciones de tipo, tamaño (5MB) y almacenamiento con nombres únicos.
 */

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const uploadsDir = path.join(process.cwd(), 'uploads', 'images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/jpg'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PNG, SVG y JPG/JPEG'));
  }
};

export const uploadProfileImage = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: fileFilter,
});

export const UPLOADS_DIR = uploadsDir;

export const handleUploadError = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'El archivo es demasiado grande. Tamaño máximo: 5MB' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: 'Campo de archivo incorrecto. Use el campo "image"' });
    }
    return res.status(400).json({ message: `Error al subir archivo: ${err.message}` });
  }
  if (err instanceof Error) {
    if (err.message.includes('Solo se permiten archivos PNG, SVG y JPG/JPEG') || 
        err.message.includes('Solo se permiten archivos PNG y SVG')) {
      return res.status(400).json({ message: err.message });
    }
    return res.status(400).json({ message: `Error: ${err.message}` });
  }
  next(err);
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
