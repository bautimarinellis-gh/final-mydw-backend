import { Router } from 'express';
import { upload } from '../middlewares/uploadMiddleware';
import { uploadProfilePhoto } from '../controllers/profileController';
import { verifyAccessTokenMiddleware, verifyUserActiveMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.post(
  '/api/profile/photo',
  verifyAccessTokenMiddleware,
  verifyUserActiveMiddleware,
  upload.single('file'),
  uploadProfilePhoto
);

export default router;