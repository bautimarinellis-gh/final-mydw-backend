import { Request, Response } from 'express';
import cloudinary from '../config/cloudinary';
import { UsuarioModel } from '../models/usuarioSchema';

export async function uploadProfilePhoto(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ message: 'No autenticado' });

    if (!req.file) {
      return res.status(400).json({ message: 'Falta el archivo (file)' });
    }

    // Subir buffer a Cloudinary
    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'mydw/profiles',
          resource_type: 'image',
          transformation: [
            { width: 512, height: 512, crop: 'fill', gravity: 'face' },
            { quality: 'auto' },
            { fetch_format: 'auto' },
          ],
        },
        (error, uploadResult) => {
          if (error) return reject(error);
          resolve(uploadResult);
        }
      );

      stream.end(req.file!.buffer);
    });

    // Guardar URL en DB (en tu modelo se llama fotoPerfil)
    const updated = await UsuarioModel.findByIdAndUpdate(
      userId,
      { fotoPerfil: result.secure_url },
      { new: true }
    );

    return res.status(200).json({
      message: 'Foto actualizada',
      fotoPerfil: result.secure_url,
      usuario: updated,
    });
  } catch (error) {
    console.error('uploadProfilePhoto error:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}