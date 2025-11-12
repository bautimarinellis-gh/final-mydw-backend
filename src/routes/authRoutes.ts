import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { register, login, refresh, logout, me, getUsuarios, updateProfile, uploadProfileImage } from '../controllers/usuarioController';
import { verifyAccessTokenMiddleware } from '../middlewares/authMiddleware';
import { uploadProfileImage as uploadMiddleware } from '../middlewares/uploadMiddleware';

const router = Router();

// Middleware para manejar errores de multer (se ejecuta después de multer si hay error)
const handleUploadError = (err: unknown, req: Request, res: Response, next: NextFunction) => {
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

// Rutas públicas (no requieren autenticación)
router.post('/register', register); // Cualquiera puede registrarse
router.post('/login', login); // Cualquiera puede iniciar sesión
router.post('/refresh', refresh); // Usa cookies, no requiere token en header
router.post('/logout', logout); // Limpia cookies, puede ser público

// Rutas protegidas (requieren autenticación con token JWT)
router.get('/me', verifyAccessTokenMiddleware, me); // Obtener perfil del usuario autenticado
router.patch('/profile', verifyAccessTokenMiddleware, updateProfile); // Actualizar perfil del usuario autenticado
// Subir imagen de perfil - el error handler se ejecuta si multer falla
router.post('/upload-profile-image', 
  verifyAccessTokenMiddleware, 
  (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware.single('image')(req, res, (err) => {
      if (err) {
        return handleUploadError(err, req, res, next);
      }
      next();
    });
  },
  uploadProfileImage
);
router.get('/usuarios', verifyAccessTokenMiddleware, getUsuarios); // Listar usuarios (protegido)

export default router;

