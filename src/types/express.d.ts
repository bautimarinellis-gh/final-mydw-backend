/**
 * express.d.ts - Extensión de tipos de Express para agregar userId en Request.
 * Permite acceder a req.userId después de la autenticación con JWT.
 */

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};

