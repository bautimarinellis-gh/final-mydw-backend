import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/tokenService';

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

    // Log para debugging (solo en desarrollo)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Auth Middleware] ${req.method} ${req.path}`);
      console.log(`[Auth Middleware] Authorization header:`, authHeader ? 'Presente' : 'Ausente');
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Log del error
      console.warn(`[Auth Middleware] Token no proporcionado para ${req.method} ${req.path}`);
      console.warn(`[Auth Middleware] Headers recibidos:`, Object.keys(req.headers));
      
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
      req.userId = payload.sub;
      next();
    } catch (tokenError) {
      // Log del error de token
      console.warn(`[Auth Middleware] Token inválido o expirado para ${req.method} ${req.path}`);
      console.warn(`[Auth Middleware] Error:`, tokenError instanceof Error ? tokenError.message : tokenError);
      
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

