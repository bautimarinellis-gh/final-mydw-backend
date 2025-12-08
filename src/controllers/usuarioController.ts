/**
 * usuarioController.ts - Controlador de autenticación y gestión de usuarios.
 * Maneja registro, login (tradicional y Google OAuth), refresh tokens, perfil, subida de imágenes y eliminación de cuentas.
 */

import { Request, Response } from 'express';
import { UsuarioModel } from '../models/usuarioSchema';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../services/tokenService';
import { deleteImageFile, getImageUrl } from '../utils/fileUtils';
import { auth } from '../config/firebase';
import { InteractionModel } from '../models/interactionSchema';
import { MatchModel } from '../models/matchSchema';
import { MessageModel } from '../models/messageSchema';

function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function sendTokenResponse(res: Response, accessToken: string, refreshToken: string, user: any, req?: Request) {
  setRefreshTokenCookie(res, refreshToken);

  const userResponse = {
    id: user._id,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    descripcion: user.descripcion,
    fotoPerfil: getImageUrl(user.fotoPerfil, req),
    carrera: user.carrera,
    sede: user.sede,
    edad: user.edad,
    intereses: user.intereses,
  };

  return { accessToken, user: userResponse };
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { nombre, apellido, email, password, descripcion, fotoPerfil, carrera, sede, edad, intereses } = req.body;

    if (!nombre || !apellido || !email || !password || !carrera || !sede || !edad) {
      res.status(400).json({ message: 'Nombre, apellido, email, password, carrera, sede y edad son requeridos' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }

    if (descripcion !== undefined && descripcion !== null) {
      if (typeof descripcion !== 'string') {
        res.status(400).json({ message: 'La descripción debe ser un string' });
        return;
      }
      if (descripcion.trim().length > 300) {
        res.status(400).json({ message: 'La descripción no puede tener más de 300 caracteres' });
        return;
      }
    }

    // Validar foto de perfil (URL válida o ruta local)
    if (fotoPerfil !== undefined && fotoPerfil !== null) {
      if (typeof fotoPerfil !== 'string') {
        res.status(400).json({ message: 'La foto de perfil debe ser un string (URL o ruta local)' });
        return;
      }
      // Validar que sea una URL válida o ruta local si no está vacío
      if (fotoPerfil.trim() !== '' && 
          !fotoPerfil.match(/^https?:\/\/.+/) && 
          !fotoPerfil.match(/^\/api\/uploads\/images\/.+/)) {
        res.status(400).json({ message: 'La foto de perfil debe ser una URL válida (http:// o https://) o una ruta local (/api/uploads/images/...)' });
        return;
      }
    }

    if (intereses !== undefined && intereses !== null) {
      if (!Array.isArray(intereses)) {
        res.status(400).json({ message: 'Los intereses deben ser un array' });
        return;
      }
      // Validar que todos los intereses sean strings
      const interesesInvalidos = intereses.some(interes => typeof interes !== 'string');
      if (interesesInvalidos) {
        res.status(400).json({ message: 'Todos los intereses deben ser strings' });
        return;
      }
    }

    const existingUser = await UsuarioModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ message: 'El email ya está registrado' });
      return;
    }

    const hashedPassword = await hashPassword(password);

    let interesesProcesados: string[] = [];
    if (intereses && Array.isArray(intereses)) {
      interesesProcesados = intereses
        .map((interes: string) => interes.trim())
        .filter((interes: string) => interes !== '')
        .filter((interes: string, index: number, self: string[]) => self.indexOf(interes) === index);
      
      if (interesesProcesados.length > 5) {
        res.status(400).json({ message: 'Máximo 5 intereses permitidos (después de eliminar duplicados y vacíos)' });
        return;
      }
    }

    const newUser = await UsuarioModel.create({
      nombre,
      apellido,
      email: email.toLowerCase(),
      password: hashedPassword,
      descripcion: descripcion?.trim() || '',
      fotoPerfil: fotoPerfil?.trim() || '',
      carrera,
      sede,
      edad,
      intereses: interesesProcesados,
    });

    const userId = String(newUser._id);
    const accessToken = signAccessToken(userId);
    const refreshToken = signRefreshToken(userId);

    const responseData = sendTokenResponse(res, accessToken, refreshToken, newUser, req);
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      ...responseData,
    });
  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email y password son requeridos' });
      return;
    }

    const user = await UsuarioModel.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      res.status(401).json({ message: 'Credenciales inválidas' });
      return;
    }

    if (user.authProvider === 'google') {
      res.status(401).json({ message: 'Esta cuenta está asociada con Google. Por favor, inicia sesión con Google' });
      return;
    }

    if (!user.password) {
      res.status(401).json({ message: 'Credenciales inválidas' });
      return;
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ message: 'Credenciales inválidas' });
      return;
    }

    if (!user.activo) {
      user.activo = true;
      await user.save();
      console.log(`Cuenta reactivada: ${email}`);
    }

    const userId = String(user._id);
    const accessToken = signAccessToken(userId);
    const refreshToken = signRefreshToken(userId);

    const responseData = sendTokenResponse(res, accessToken, refreshToken, user, req);
    res.status(200).json({
      message: 'Inicio de sesión exitoso',
      ...responseData,
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function loginWithGoogle(req: Request, res: Response): Promise<void> {
  try {
    const { idToken, carrera, sede, edad, intereses } = req.body;

    if (!idToken) {
      res.status(400).json({ message: 'Token de ID de Google es requerido' });
      return;
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error('Error al verificar token de Google:', error);
      res.status(401).json({ message: 'Token de Google inválido o expirado' });
      return;
    }

    const googleId = decodedToken.uid;
    const email = decodedToken.email?.toLowerCase();
    const name = decodedToken.name || '';
    const picture = decodedToken.picture || '';

    if (!email) {
      res.status(400).json({ message: 'No se pudo obtener el email de la cuenta de Google' });
      return;
    }

    let nombre = decodedToken.given_name || '';
    let apellido = decodedToken.family_name || '';

    if (!nombre || !apellido) {
      const nameParts = name.trim().split(' ');
      if (nameParts.length >= 2) {
        nombre = nameParts[0];
        apellido = nameParts.slice(1).join(' ');
      } else if (nameParts.length === 1) {
        nombre = nameParts[0];
        apellido = '';
      } else {
        nombre = email.split('@')[0];
        apellido = '';
      }
    }

    if (!nombre || nombre.trim() === '') {
      res.status(400).json({ message: 'No se pudo obtener el nombre de la cuenta de Google' });
      return;
    }

    let user = await UsuarioModel.findOne({
      $or: [
        { email: email },
        { googleId: googleId }
      ]
    });

    const isRegisterMode = carrera !== undefined && sede !== undefined && edad !== undefined;

    if (isRegisterMode) {
      if (!carrera || !sede || !edad) {
        res.status(400).json({ message: 'Carrera, sede y edad son requeridos para el registro' });
        return;
      }

      if (typeof edad !== 'number' || edad < 18 || edad > 100) {
        res.status(400).json({ message: 'La edad debe ser un número entre 18 y 100' });
        return;
      }

      let interesesProcesados: string[] = [];
      if (intereses !== undefined && intereses !== null) {
        if (!Array.isArray(intereses)) {
          res.status(400).json({ message: 'Los intereses deben ser un array' });
          return;
        }
        const interesesInvalidos = intereses.some(interes => typeof interes !== 'string');
        if (interesesInvalidos) {
          res.status(400).json({ message: 'Todos los intereses deben ser strings' });
          return;
        }
        
        interesesProcesados = intereses
          .map((interes: string) => interes.trim())
          .filter((interes: string) => interes !== '')
          .filter((interes: string, index: number, self: string[]) => self.indexOf(interes) === index);
        
        if (interesesProcesados.length > 5) {
          res.status(400).json({ message: 'Máximo 5 intereses permitidos (después de eliminar duplicados y vacíos)' });
          return;
        }
      }

      if (user) {
        res.status(409).json({ message: 'Este usuario ya está registrado. Por favor, inicia sesión' });
        return;
      }

      const existingEmail = await UsuarioModel.findOne({ email: email });
      if (existingEmail) {
        res.status(409).json({ message: 'El email ya está registrado' });
        return;
      }

      user = await UsuarioModel.create({
        nombre,
        apellido: apellido || 'Sin apellido',
        email: email,
        googleId: googleId,
        authProvider: 'google',
        password: undefined,
        carrera,
        sede,
        edad,
        fotoPerfil: picture || '',
        intereses: interesesProcesados,
      });

      const userId = String(user._id);
      const accessToken = signAccessToken(userId);
      const refreshToken = signRefreshToken(userId);

      const responseData = sendTokenResponse(res, accessToken, refreshToken, user, req);
      res.status(201).json({
        message: 'Registro exitoso. Serás redirigido al inicio de sesión...',
        ...responseData,
      });

    } else {
      if (!user) {
        res.status(404).json({ message: 'Usuario no registrado. Por favor, regístrate primero' });
        return;
      }

      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
        if (picture && (!user.fotoPerfil || user.fotoPerfil.trim() === '')) {
          user.fotoPerfil = picture;
        }
        user.nombre = nombre;
        if (apellido && apellido.trim() !== '') {
          user.apellido = apellido;
        }
        await user.save();
      } else if (user.googleId !== googleId) {
        res.status(409).json({ message: 'Esta cuenta de Google ya está asociada con otro usuario' });
        return;
      }

      // Si la cuenta estaba desactivada, reactivarla automáticamente
      if (!user.activo) {
        user.activo = true;
        await user.save();
        console.log(`[Auth] Cuenta reactivada con Google: ${email}`);
      }

      const userId = String(user._id);
      const accessToken = signAccessToken(userId);
      const refreshToken = signRefreshToken(userId);

      const responseData = sendTokenResponse(res, accessToken, refreshToken, user, req);
      res.status(200).json({
        message: 'Inicio de sesión con Google exitoso',
        ...responseData,
      });
    }
  } catch (error) {
    console.error('Error en loginWithGoogle:', error);
    
    // Manejar errores específicos
    if (error instanceof Error) {
      if (error.message.includes('email')) {
        res.status(409).json({ message: 'El email ya está registrado' });
        return;
      }
      if (error.message.includes('googleId')) {
        res.status(409).json({ message: 'Esta cuenta de Google ya está asociada con otro usuario' });
        return;
      }
    }
    
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ message: 'Refresh token no proporcionado' });
      return;
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      res.status(401).json({ message: 'Refresh token inválido o expirado' });
      return;
    }

    const user = await UsuarioModel.findById(payload.sub);
    if (!user) {
      res.status(401).json({ message: 'Usuario no encontrado' });
      return;
    }

    const userId = String(user._id);
    const newAccessToken = signAccessToken(userId);
    const newRefreshToken = signRefreshToken(userId);

    // Enviar nueva cookie (refresh token solo en cookie HTTP-only)
    setRefreshTokenCookie(res, newRefreshToken);

    res.status(200).json({
      message: 'Token renovado exitosamente',
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error('Error en refresh:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/', // Mismo path que se usó para crear la cookie
    });
    res.status(200).json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function me(req: Request, res: Response): Promise<void> {
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

    res.status(200).json({
      user: {
        id: user._id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        descripcion: user.descripcion,
        fotoPerfil: getImageUrl(user.fotoPerfil, req),
        carrera: user.carrera,
        sede: user.sede,
        edad: user.edad,
        intereses: user.intereses,
      },
    });
  } catch (error) {
    console.error('Error en me:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const { descripcion, fotoPerfil, intereses } = req.body;

    if (descripcion !== undefined && descripcion !== null) {
      if (typeof descripcion !== 'string') {
        res.status(400).json({ message: 'La descripción debe ser un string' });
        return;
      }
      if (descripcion.trim().length > 300) {
        res.status(400).json({ message: 'La descripción no puede tener más de 300 caracteres' });
        return;
      }
    }

    // Validar foto de perfil (URL válida o ruta local)
    if (fotoPerfil !== undefined && fotoPerfil !== null) {
      if (typeof fotoPerfil !== 'string') {
        res.status(400).json({ message: 'La foto de perfil debe ser un string (URL o ruta local)' });
        return;
      }
      // Validar que sea una URL válida o ruta local si no está vacío
      if (fotoPerfil.trim() !== '' && 
          !fotoPerfil.match(/^https?:\/\/.+/) && 
          !fotoPerfil.match(/^\/api\/uploads\/images\/.+/)) {
        res.status(400).json({ message: 'La foto de perfil debe ser una URL válida (http:// o https://) o una ruta local (/api/uploads/images/...)' });
        return;
      }
    }

    if (intereses !== undefined && intereses !== null) {
      if (!Array.isArray(intereses)) {
        res.status(400).json({ message: 'Los intereses deben ser un array' });
        return;
      }
      const interesesInvalidos = intereses.some(interes => typeof interes !== 'string');
      if (interesesInvalidos) {
        res.status(400).json({ message: 'Todos los intereses deben ser strings' });
        return;
      }
      if (intereses.length > 5) {
        res.status(400).json({ message: 'Máximo 5 intereses permitidos' });
        return;
      }
    }

    const user = await UsuarioModel.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    const updateData: any = {};
    
    if (descripcion !== undefined) {
      updateData.descripcion = descripcion.trim();
    }
    
    if (fotoPerfil !== undefined) {
      updateData.fotoPerfil = fotoPerfil.trim();
    }
    
    if (intereses !== undefined) {
      const interesesProcesados = intereses
        .map((interes: string) => interes.trim())
        .filter((interes: string) => interes !== '')
        .filter((interes: string, index: number, self: string[]) => self.indexOf(interes) === index);
      
      if (interesesProcesados.length > 5) {
        res.status(400).json({ message: 'Máximo 5 intereses permitidos (después de eliminar duplicados y vacíos)' });
        return;
      }
      
      updateData.intereses = interesesProcesados;
    }

    // Actualizar usuario
    const updatedUser = await UsuarioModel.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    // Formatear respuesta
    const userResponse = {
      id: updatedUser._id,
      nombre: updatedUser.nombre,
      apellido: updatedUser.apellido,
      email: updatedUser.email,
      descripcion: updatedUser.descripcion,
      fotoPerfil: getImageUrl(updatedUser.fotoPerfil, req),
      carrera: updatedUser.carrera,
      sede: updatedUser.sede,
      edad: updatedUser.edad,
      intereses: updatedUser.intereses,
    };

    res.status(200).json({
      message: 'Perfil actualizado exitosamente',
      user: userResponse,
    });
  } catch (error) {
    console.error('Error en updateProfile:', error);
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// POST /api/auth/upload-profile-image (protegido)
export async function uploadProfileImage(req: Request, res: Response): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    // Verificar que se haya subido un archivo
    if (!req.file) {
      res.status(400).json({ message: 'No se proporcionó ningún archivo' });
      return;
    }

    // Buscar usuario
    const user = await UsuarioModel.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    // Eliminar imagen anterior si existe
    if (user.fotoPerfil && user.fotoPerfil.trim() !== '') {
      deleteImageFile(user.fotoPerfil);
    }

    // Construir la URL de la nueva imagen
    const imageUrl = `/api/uploads/images/${req.file.filename}`;

    // Actualizar fotoPerfil en la base de datos
    user.fotoPerfil = imageUrl;
    await user.save();

    // Formatear respuesta
    const imageUrlAbsolute = getImageUrl(imageUrl, req);
    const userResponse = {
      id: user._id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      descripcion: user.descripcion,
      fotoPerfil: imageUrlAbsolute,
      carrera: user.carrera,
      sede: user.sede,
      edad: user.edad,
      intereses: user.intereses,
    };

    res.status(200).json({
      message: 'Imagen de perfil subida exitosamente',
      user: userResponse,
      imageUrl: imageUrlAbsolute,
    });
  } catch (error) {
    console.error('Error en uploadProfileImage:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// GET /api/auth/usuarios
export async function getUsuarios(req: Request, res: Response): Promise<void> {
  try {
    // Obtener todos los usuarios (sin password)
    // Excluir usuarios desactivados
    const usuarios = await UsuarioModel.find({ activo: true }).select('-password');

    // Formatear respuesta
    const usuariosResponse = usuarios.map(usuario => ({
      id: usuario._id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      descripcion: usuario.descripcion,
      fotoPerfil: getImageUrl(usuario.fotoPerfil, req),
      carrera: usuario.carrera,
      sede: usuario.sede,
      edad: usuario.edad,
      intereses: usuario.intereses,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    }));

    res.status(200).json({
      message: 'Usuarios obtenidos exitosamente',
      usuarios: usuariosResponse,
      total: usuariosResponse.length,
    });
  } catch (error) {
    console.error('Error en getUsuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// PATCH /api/auth/me/deactivate
export async function deactivateAccount(req: Request, res: Response): Promise<void> {
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
      res.status(400).json({ message: 'La cuenta ya está desactivada' });
      return;
    }

    user.activo = false;
    await user.save();

    // Limpiar cookie de refresh para forzar logout en cliente
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    });

    res.status(200).json({ message: 'Cuenta desactivada exitosamente' });
  } catch (error) {
    console.error('Error en deactivateAccount:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// DELETE /api/auth/me
export async function deleteAccount(req: Request, res: Response): Promise<void> {
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

    // Eliminar imagen de perfil del filesystem si es ruta local
    if (user.fotoPerfil && user.fotoPerfil.startsWith('/api/uploads/images/')) {
      try {
        deleteImageFile(user.fotoPerfil);
      } catch (err) {
        console.warn('No se pudo eliminar la imagen de perfil:', err);
      }
    }

    // Eliminar interacciones donde el usuario es autor o objetivo
    await InteractionModel.deleteMany({
      $or: [ { usuarioId: user._id }, { estudianteId: user._id } ]
    });

    // Eliminar matches donde participa
    await MatchModel.deleteMany({
      $or: [ { usuario1Id: user._id }, { usuario2Id: user._id } ]
    });

    // Eliminar mensajes enviados o recibidos
    await MessageModel.deleteMany({
      $or: [ { remitenteId: user._id }, { destinatarioId: user._id } ]
    });

    // Finalmente eliminar usuario
    await UsuarioModel.findByIdAndDelete(user._id);

    // Limpiar cookie de refresh
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    });

    res.status(200).json({ message: 'Cuenta eliminada exitosamente' });
  } catch (error) {
    console.error('Error en deleteAccount:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}
