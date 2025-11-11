import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/tokenService';

export function verifyAccessTokenMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Token de acceso no proporcionado' });
      return;
    }

    const token = authHeader.substring(7); // Remover "Bearer "
    const payload = verifyAccessToken(token);

    req.userId = payload.sub;

    next();
  } catch (error) {
    res.status(401).json({ message: 'Token de acceso inválido o expirado' });
  }
}

