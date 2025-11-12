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

