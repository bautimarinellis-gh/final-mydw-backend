/**
 * authMiddleware.ts - Middlewares de autenticación para validar JWT y estado de usuarios.
 * Incluye verificación de access tokens y validación de cuentas activas.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/tokenService';
import { UsuarioModel } from '../models/usuarioSchema';

export function verifyAccessTokenMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
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

    const token = authHeader.substring(7);
    
    try {
      const payload = verifyAccessToken(token);
      req.userId = payload.sub;
      
      next();
    } catch (tokenError) {
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
    console.error('Error inesperado en auth middleware:', error);
    res.status(500).json({ message: 'Error interno del servidor en autenticación' });
  }
}

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
    console.error('Error inesperado en active user middleware:', error);
    res.status(500).json({ message: 'Error interno del servidor al validar usuario' });
  }
}


