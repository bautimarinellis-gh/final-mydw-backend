import { Request, Response } from 'express';
import { UsuarioModel } from '../models/usuarioSchema';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../services/tokenService';

// Helper para enviar tokens
function sendTokenResponse(res: Response, accessToken: string, refreshToken: string, user: any) {
  // Configurar cookie httpOnly para refresh token
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    path: '/api/auth',
  });

  // Usuario sin password
  const userResponse = {
    id: user._id,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    descripcion: user.descripcion,
    carrera: user.carrera,
    sede: user.sede,
    edad: user.edad,
    intereses: user.intereses,
  };

  return { accessToken, user: userResponse };
}

// POST /api/auth/register
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { nombre, apellido, email, password, descripcion, carrera, sede, edad, intereses } = req.body;

    // Validaciones básicas
    if (!nombre || !apellido || !email || !password || !carrera || !sede || !edad) {
      res.status(400).json({ message: 'Nombre, apellido, email, password, carrera, sede y edad son requeridos' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }

    // Verificar email único
    const existingUser = await UsuarioModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ message: 'El email ya está registrado' });
      return;
    }

    // Hashear password
    const hashedPassword = await hashPassword(password);

    // Crear usuario
    const newUser = await UsuarioModel.create({
      nombre,
      apellido,
      email: email.toLowerCase(),
      password: hashedPassword,
      descripcion: descripcion,
      carrera,
      sede,
      edad,
      intereses: intereses || [],
    });

    // Crear tokens
    const userId = String(newUser._id);
    const accessToken = signAccessToken(userId);
    const refreshToken = signRefreshToken(userId);
    
    // Guardar refresh token hasheado en el usuario
    const hashedRefreshToken = await hashPassword(refreshToken);
    await UsuarioModel.findByIdAndUpdate(userId, {
      $push: { refreshTokens: hashedRefreshToken }
    });

    const responseData = sendTokenResponse(res, accessToken, refreshToken, newUser);
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
    
    // Guardar refresh token hasheado
    const hashedRefreshToken = await hashPassword(refreshToken);
    await UsuarioModel.findByIdAndUpdate(userId, {
      $push: { refreshTokens: hashedRefreshToken }
    });

    const responseData = sendTokenResponse(res, accessToken, refreshToken, user);
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

    // Verificar firma del token
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      res.status(401).json({ message: 'Refresh token inválido o expirado' });
      return;
    }

    // Buscar usuario con sus refresh tokens
    const user = await UsuarioModel.findById(payload.sub).select('+refreshTokens');
    if (!user) {
      res.status(401).json({ message: 'Usuario no encontrado' });
      return;
    }

    // Verificar que el refresh token esté en la lista de tokens válidos del usuario
    let isValidToken = false;
    for (const storedToken of user.refreshTokens) {
      if (await comparePassword(refreshToken, storedToken)) {
        isValidToken = true;
        break;
      }
    }

    if (!isValidToken) {
      res.status(401).json({ message: 'Refresh token inválido' });
      return;
    }

    // Generar nuevos tokens
    const userId = String(user._id);
    const newAccessToken = signAccessToken(userId);
    const newRefreshToken = signRefreshToken(userId);

    // Hashear el nuevo refresh token y agregarlo
    const hashedNewRefreshToken = await hashPassword(newRefreshToken);
    await UsuarioModel.findByIdAndUpdate(userId, {
      $push: { refreshTokens: hashedNewRefreshToken }
    });

    // Enviar nueva cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

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
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        
        // Buscar usuario y eliminar el refresh token específico
        const user = await UsuarioModel.findById(payload.sub).select('+refreshTokens');
        if (user) {
          // Filtrar tokens que no coincidan con el actual
          const updatedTokens = [];
          for (const storedToken of user.refreshTokens) {
            if (!(await comparePassword(refreshToken, storedToken))) {
              updatedTokens.push(storedToken);
            }
          }
          await UsuarioModel.findByIdAndUpdate(payload.sub, {
            refreshTokens: updatedTokens
          });
        }
      } catch (error) {
        // Token inválido, pero igual limpiamos la cookie
      }
    }

    // Limpiar cookie
    res.clearCookie('refreshToken', { path: '/api/auth' });
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

// GET /api/auth/usuarios (protegido)
export async function getUsuarios(req: Request, res: Response): Promise<void> {
  try {
    // Obtener todos los usuarios (sin password y sin refreshTokens)
    const usuarios = await UsuarioModel.find({}).select('-password -refreshTokens');

    // Formatear respuesta
    const usuariosResponse = usuarios.map(usuario => ({
      id: usuario._id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      descripcion: usuario.descripcion,
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
