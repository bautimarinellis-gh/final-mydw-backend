import { Request, Response } from 'express';
import { UsuarioModel } from '../models/usuarioSchema';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../services/tokenService';
import { deleteImageFile, getImageUrl } from '../utils/fileUtils';

// Helper para configurar cookies de refresh token
function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true, // No accesible por JavaScript (más seguro)
    secure: isProduction, // Solo HTTPS en producción
    sameSite: isProduction ? 'none' : 'lax', // 'none' permite cross-origin en producción
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    path: '/', // Disponible en todas las rutas
  });
}

// Helper para enviar tokens
function sendTokenResponse(res: Response, accessToken: string, refreshToken: string, user: any, req?: Request) {
  // Configurar cookie httpOnly para refresh token (más seguro, no accesible por JavaScript)
  setRefreshTokenCookie(res, refreshToken);

  // Usuario sin password
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

  // Solo devolver accessToken en el body (para localStorage)
  // refreshToken solo en cookie HTTP-only (más seguro)
  return { accessToken, user: userResponse };
}

// POST /api/auth/register
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { nombre, apellido, email, password, descripcion, fotoPerfil, carrera, sede, edad, intereses } = req.body;

    // Validaciones básicas
    if (!nombre || !apellido || !email || !password || !carrera || !sede || !edad) {
      res.status(400).json({ message: 'Nombre, apellido, email, password, carrera, sede y edad son requeridos' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }

    // Validar descripción (máximo 300 caracteres)
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

    // Validar y procesar intereses
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

    // Verificar email único
    const existingUser = await UsuarioModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ message: 'El email ya está registrado' });
      return;
    }

    // Hashear password
    const hashedPassword = await hashPassword(password);

    // Procesar intereses: limpiar, eliminar duplicados y validar máximo 5
    let interesesProcesados: string[] = [];
    if (intereses && Array.isArray(intereses)) {
      interesesProcesados = intereses
        .map((interes: string) => interes.trim())
        .filter((interes: string) => interes !== '') // Eliminar strings vacíos
        .filter((interes: string, index: number, self: string[]) => self.indexOf(interes) === index); // Eliminar duplicados
      
      // Validar que después de procesar no haya más de 5
      if (interesesProcesados.length > 5) {
        res.status(400).json({ message: 'Máximo 5 intereses permitidos (después de eliminar duplicados y vacíos)' });
        return;
      }
    }

    // Crear usuario
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

    // Crear tokens
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

// POST /api/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email y password son requeridos' });
      return;
    }

    // Buscar usuario (incluir password explícitamente)
    const user = await UsuarioModel.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      res.status(401).json({ message: 'Credenciales inválidas' });
      return;
    }

    // Verificar password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ message: 'Credenciales inválidas' });
      return;
    }

    // Crear tokens
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

// POST /api/auth/refresh
export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ message: 'Refresh token no proporcionado' });
      return;
    }

    // Verificar firma del token (si es válido y no expirado)
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      res.status(401).json({ message: 'Refresh token inválido o expirado' });
      return;
    }

    // Verificar que el usuario existe
    const user = await UsuarioModel.findById(payload.sub);
    if (!user) {
      res.status(401).json({ message: 'Usuario no encontrado' });
      return;
    }

    // Generar nuevos tokens
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

// POST /api/auth/logout
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    // Limpiar cookie con las mismas opciones que se usaron para crearla
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

// GET /api/me (protegido)
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

// PATCH /api/auth/profile (protegido)
export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const { descripcion, fotoPerfil, intereses } = req.body;

    // Validar descripción (máximo 300 caracteres)
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

    // Validar intereses
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
      // Validar máximo 5 intereses
      if (intereses.length > 5) {
        res.status(400).json({ message: 'Máximo 5 intereses permitidos' });
        return;
      }
    }

    // Buscar usuario
    const user = await UsuarioModel.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    // Construir objeto de actualización solo con los campos proporcionados
    const updateData: any = {};
    
    if (descripcion !== undefined) {
      updateData.descripcion = descripcion.trim();
    }
    
    if (fotoPerfil !== undefined) {
      updateData.fotoPerfil = fotoPerfil.trim();
    }
    
    if (intereses !== undefined) {
      // Procesar intereses: limpiar, eliminar duplicados y vacíos
      const interesesProcesados = intereses
        .map((interes: string) => interes.trim())
        .filter((interes: string) => interes !== '') // Eliminar strings vacíos
        .filter((interes: string, index: number, self: string[]) => self.indexOf(interes) === index); // Eliminar duplicados
      
      // Validar que después de procesar no haya más de 5
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
    const usuarios = await UsuarioModel.find({}).select('-password');

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
