import { Router, Request, Response, NextFunction } from 'express';
import { register, login, loginWithGoogle, refresh, logout, me, getUsuarios, updateProfile, uploadProfileImage } from '../controllers/usuarioController';
import { verifyAccessTokenMiddleware } from '../middlewares/authMiddleware';
import { uploadProfileImage as uploadMiddleware, handleUploadError } from '../middlewares/uploadMiddleware';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.post('/register', register); // Cualquiera puede registrarse
router.post('/login', login); // Cualquiera puede iniciar sesión
router.post('/google', loginWithGoogle); // Autenticación con Google
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

