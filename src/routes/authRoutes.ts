import { Router, Request, Response, NextFunction } from 'express';
import { register, login, loginWithGoogle, refresh, logout, me, getUsuarios, updateProfile, uploadProfileImage, deactivateAccount, deleteAccount } from '../controllers/usuarioController';
import { verifyAccessTokenMiddleware, verifyUserActiveMiddleware } from '../middlewares/authMiddleware';
import { uploadProfileImage as uploadMiddleware, handleUploadError } from '../middlewares/uploadMiddleware';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.post('/register', register); // Cualquiera puede registrarse
router.post('/login', login); // Cualquiera puede iniciar sesión
router.post('/google', loginWithGoogle); // Autenticación con Google
router.post('/refresh', refresh); // Usa cookies, no requiere token en header
router.post('/logout', logout); // Limpia cookies, puede ser público

router.get(
  '/api/discover/next',
  verifyAccessTokenMiddleware,
  verifyUserActiveMiddleware,
  getUsuarios
);

// Rutas protegidas (requieren autenticación con token JWT)
router.get('/me', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, me); // Obtener perfil del usuario autenticado
router.patch('/profile', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, updateProfile); // Actualizar perfil del usuario autenticado
// Subir imagen de perfil - el error handler se ejecuta si multer falla
router.post('/upload-profile-image', 
  verifyAccessTokenMiddleware, 
  verifyUserActiveMiddleware,
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
router.get('/usuarios', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, getUsuarios); // Listar usuarios (protegido)
// Desactivar cuenta (solo el usuario puede desactivar la suya)
router.patch('/me/deactivate', verifyAccessTokenMiddleware, deactivateAccount);
// Eliminar cuenta del usuario autenticado
router.delete('/me', verifyAccessTokenMiddleware, deleteAccount);

export default router;