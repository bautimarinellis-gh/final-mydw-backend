import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/tokenService';
import { UsuarioModel } from '../models/usuarioSchema';

export function verifyAccessTokenMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Permitir peticiones OPTIONS (preflight de CORS) sin autenticación
    if (req.method === 'OPTIONS') {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        message: 'Token de acceso no proporcionado',
        path: req.path,
        method: req.method
      });
      return;
    }

    const token = authHeader.substring(7); // Remover "Bearer "
    
    try {
      const payload = verifyAccessToken(token);
      req.userId = String(payload.sub);
      
      // Validar que el usuario existe y está activo
      // Hacer esto de forma asincrónica en un middleware separado
      next();
    } catch (tokenError) {
      // Distinguir entre token expirado y token inválido
      const isExpired = tokenError instanceof Error && 
        (tokenError.message.includes('expired') || tokenError.message.includes('jwt expired'));
      
      res.status(401).json({ 
        message: isExpired ? 'Token de acceso expirado' : 'Token de acceso inválido',
        code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
        path: req.path,
        method: req.method
      });
    }
  } catch (error) {
    console.error('[Auth Middleware] Error inesperado:', error);
    res.status(500).json({ message: 'Error interno del servidor en autenticación' });
  }
}

// Middleware para validar que el usuario está activo (debe ir DESPUÉS de verifyAccessTokenMiddleware)
export async function verifyUserActiveMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const user = await UsuarioModel.findById(req.userId);
    
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    if (!user.activo) {
      res.status(403).json({ 
        message: 'Tu cuenta ha sido desactivada. No puedes acceder a este recurso.',
        code: 'ACCOUNT_DEACTIVATED'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[Active User Middleware] Error inesperado:', error);
    res.status(500).json({ message: 'Error interno del servidor al validar usuario' });
  }
}


