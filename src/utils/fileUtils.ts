import fs from 'fs';
import path from 'path';

/**
 * Elimina un archivo de imagen del sistema de archivos
 * @param imagePath - Ruta relativa o absoluta del archivo a eliminar
 * @returns true si se eliminó correctamente, false si no existía o hubo error
 */
export function deleteImageFile(imagePath: string): boolean {
  try {
    // Si es una URL externa (http:// o https://), no intentar eliminarla
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return false;
    }
    
    // Si es una ruta relativa que empieza con /api/uploads/images/
    // Extraer el nombre del archivo
    let filePath = imagePath;
    
    if (imagePath.startsWith('/api/uploads/images/')) {
      const filename = path.basename(imagePath);
      filePath = path.join(process.cwd(), 'uploads', 'images', filename);
    } else if (!path.isAbsolute(imagePath)) {
      // Si es relativa pero no empieza con /api/, asumir que es desde uploads/images
      filePath = path.join(process.cwd(), 'uploads', 'images', path.basename(imagePath));
    }
    
    // Verificar si el archivo existe
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

/**
 * Obtiene la ruta completa del archivo de imagen
 * @param filename - Nombre del archivo
 * @returns Ruta completa del archivo
 */
export function getImagePath(filename: string): string {
  return path.join(process.cwd(), 'uploads', 'images', filename);
}

/**
 * Convierte una ruta relativa de imagen a una URL absoluta
 * @param imagePath - Ruta relativa (/api/uploads/images/...) o URL absoluta
 * @param req - Request object de Express para obtener el protocolo y host
 * @returns URL absoluta de la imagen
 */
export function getImageUrl(imagePath: string | undefined | null, req?: any): string {
  // Si está vacía o es null/undefined, devolver string vacío
  if (!imagePath || imagePath.trim() === '') {
    return '';
  }

  // Si ya es una URL absoluta (http:// o https://), devolverla tal cual
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // Si es una ruta relativa que empieza con /api/uploads/images/
  if (imagePath.startsWith('/api/uploads/images/')) {
    // Si tenemos el request object, usar el protocolo y host del request
    if (req) {
      // En producción, los proxies reversos pueden usar X-Forwarded-Proto
      // Si está presente, usarlo; de lo contrario, usar req.protocol
      const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
      const host = req.get('host') || req.get('X-Forwarded-Host') || process.env.BACKEND_URL || 'localhost:3000';
      
      // Asegurar que el protocolo sea https en producción si no se especifica
      const finalProtocol = process.env.NODE_ENV === 'production' && protocol === 'http' ? 'https' : protocol;
      
      return `${finalProtocol}://${host}${imagePath}`;
    }
    
    // Si no tenemos el request, usar la variable de entorno o un valor por defecto
    const backendUrl = process.env.BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'https://localhost:3000' : 'http://localhost:3000');
    return `${backendUrl}${imagePath}`;
  }

  // Si no coincide con ningún patrón conocido, devolver tal cual
  return imagePath;
}

