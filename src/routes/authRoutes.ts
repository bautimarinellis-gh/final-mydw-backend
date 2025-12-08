/**
 * authRoutes.ts - Rutas de autenticación y gestión de usuarios.
 * Incluye registro, login (tradicional y Google), refresh tokens, perfil, subida de imágenes y gestión de cuenta.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { register, login, loginWithGoogle, refresh, logout, me, getUsuarios, updateProfile, uploadProfileImage, deactivateAccount, deleteAccount } from '../controllers/usuarioController';
import { verifyAccessTokenMiddleware, verifyUserActiveMiddleware } from '../middlewares/authMiddleware';
import { uploadProfileImage as uploadMiddleware, handleUploadError } from '../middlewares/uploadMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', loginWithGoogle);
router.post('/refresh', refresh);
router.post('/logout', logout);

router.get('/me', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, me);
router.patch('/profile', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, updateProfile);
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
router.get('/usuarios', verifyAccessTokenMiddleware, verifyUserActiveMiddleware, getUsuarios);
router.patch('/me/deactivate', verifyAccessTokenMiddleware, deactivateAccount);
router.delete('/me', verifyAccessTokenMiddleware, deleteAccount);

export default router;

