/**
 * fileUtils.ts - Utilidades para gestión de archivos de imágenes.
 * Incluye eliminación, construcción de rutas y conversión de rutas relativas a URLs absolutas.
 */

import fs from 'fs';
import path from 'path';

export function deleteImageFile(imagePath: string): boolean {
  try {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return false;
    }
    
    let filePath = imagePath;
    
    if (imagePath.startsWith('/api/uploads/images/')) {
      const filename = path.basename(imagePath);
      filePath = path.join(process.cwd(), 'uploads', 'images', filename);
    } else if (!path.isAbsolute(imagePath)) {
      filePath = path.join(process.cwd(), 'uploads', 'images', path.basename(imagePath));
    }
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error al eliminar archivo de imagen:', error);
    return false;
  }
}

export function getImagePath(filename: string): string {
  return path.join(process.cwd(), 'uploads', 'images', filename);
}

export function getImageUrl(imagePath: string | undefined | null, req?: any): string {
  if (!imagePath || imagePath.trim() === '') {
    return '';
  }

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  if (imagePath.startsWith('/api/uploads/images/')) {
    if (req) {
      const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
      const host = req.get('host') || req.get('X-Forwarded-Host') || process.env.BACKEND_URL || 'localhost:3000';
      
      const finalProtocol = process.env.NODE_ENV === 'production' && protocol === 'http' ? 'https' : protocol;
      
      return `${finalProtocol}://${host}${imagePath}`;
    }
    
    const backendUrl = process.env.BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'https://localhost:3000' : 'http://localhost:3000');
    return `${backendUrl}${imagePath}`;
  }

  return imagePath;
}

