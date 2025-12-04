import { Request, Response } from 'express';
import { UsuarioModel } from '../models/usuarioSchema';
import { InteractionModel } from '../models/interactionSchema';
import { MatchModel } from '../models/matchSchema';
import mongoose from 'mongoose';
import { getImageUrl } from '../utils/fileUtils';

// GET /api/discover/next
// GET /api/discover/next
export async function getNextProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId; // Ahora siempre debe estar presente con autenticación

    let excluirIds: mongoose.Types.ObjectId[] = [];

    // Si hay usuario autenticado, aplicar filtros para excluir usuarios ya interactuados
    if (userId) {
      // Convertir userId a ObjectId válido
      const userIdObjectId = new mongoose.Types.ObjectId(userId);

      // Obtener IDs de usuarios ya interactuados (like o dislike) - usar ObjectId para consistencia
      const interacciones = await InteractionModel.find({ usuarioId: userIdObjectId }).select('estudianteId');
      
      // Convertir y validar todos los IDs de interacciones
      const interactuadosIds = interacciones
        .map(i => i.estudianteId)
        .filter(id => id != null && mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

      // Obtener IDs de usuarios con match - usar ObjectId para consistencia
      const matches = await MatchModel.find({
        $or: [
          { usuario1Id: userIdObjectId },
          { usuario2Id: userIdObjectId }
        ]
      });
      
      // Convertir y validar todos los IDs de matches
      const matcheadosIds = matches
        .map(m => {
          // Comparar ObjectIds directamente para consistencia
          const otroUsuarioId = m.usuario1Id.equals(userIdObjectId) ? m.usuario2Id : m.usuario1Id;
          return otroUsuarioId;
        })
        .filter(id => id != null && mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

      // Combinar IDs a excluir - asegurar que todos sean ObjectIds válidos y únicos
      const todosLosIds = [
        ...interactuadosIds,
        ...matcheadosIds,
        userIdObjectId
      ];

      // Eliminar duplicados usando Set y filtrar solo ObjectIds válidos
      excluirIds = Array.from(
        new Set(todosLosIds.map(id => id.toString()))
      )
        .filter(idStr => mongoose.Types.ObjectId.isValid(idStr))
        .map(idStr => new mongoose.Types.ObjectId(idStr));
    }

    // 🔹 NUEVO: leer filtros desde query
    const {
      sede,
      carrera,
      edadMin,
      edadMax,
      interes, // un interés concreto
      q,       // búsqueda de texto (nombre / apellido / descripción)
    } = req.query;

    const filtrosExtra: any = {};

    if (sede) filtrosExtra.sede = sede;
    if (carrera) filtrosExtra.carrera = carrera;

    if (edadMin || edadMax) {
      filtrosExtra.edad = {};
      if (edadMin) filtrosExtra.edad.$gte = Number(edadMin);
      if (edadMax) filtrosExtra.edad.$lte = Number(edadMax);
    }

    if (interes) {
      filtrosExtra.intereses = { $in: [interes] }; // coincide con al menos ese interés
    }

    if (q) {
      const regex = new RegExp(String(q), 'i');
      filtrosExtra.$or = [
        { nombre: regex },
        { apellido: regex },
        { descripcion: regex },
      ];
    }

    // Buscar usuarios (con o sin filtros según si hay userId)
    const baseQuery = excluirIds.length > 0 
      ? { _id: { $nin: excluirIds } }
      : {};

    // 🔹 finalQuery combina:
    // - excluirIds (likes/dislikes/matches + uno mismo)
    // - filtros extra (sede, carrera, edad, interés, búsqueda)
    // - solo usuarios activos
    const finalQuery = {
      ...baseQuery,
      ...filtrosExtra,
      activo: true,
    };

    const estudiantes = await UsuarioModel.find(finalQuery);

    if (estudiantes.length === 0) {
      res.status(200).json({
        message: 'No hay más perfiles disponibles',
        estudiante: null
      });
      return;
    }

    // Seleccionar uno aleatorio
    const randomIndex = Math.floor(Math.random() * estudiantes.length);
    const estudiante = estudiantes[randomIndex];

    res.status(200).json({
      estudiante: {
        id: estudiante._id,
        nombre: estudiante.nombre,
        apellido: estudiante.apellido,
        fotoPerfil: getImageUrl(estudiante.fotoPerfil, req),
        descripcion: estudiante.descripcion,
        carrera: estudiante.carrera,
        sede: estudiante.sede,
        edad: estudiante.edad,
        intereses: estudiante.intereses,
      }
    });
  } catch (error) {
    console.error('Error en getNextProfile:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// POST /api/discover/swipe
export async function swipe(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    const { estudianteId, tipo } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    // Validaciones
    if (!estudianteId || !tipo) {
      res.status(400).json({ message: 'estudianteId y tipo son requeridos' });
      return;
    }

    if (tipo !== 'like' && tipo !== 'dislike') {
      res.status(400).json({ message: 'tipo debe ser "like" o "dislike"' });
      return;
    }

    if (userId === estudianteId) {
      res.status(400).json({ message: 'No puedes interactuar contigo mismo' });
      return;
    }

    // Verificar que el estudiante existe
    const estudiante = await UsuarioModel.findById(estudianteId);
    if (!estudiante) {
      res.status(404).json({ message: 'Estudiante no encontrado' });
      return;
    }

    // Convertir IDs a ObjectId para asegurar consistencia en la búsqueda
    const userIdObjectId = new mongoose.Types.ObjectId(userId);
    const estudianteIdObjectId = new mongoose.Types.ObjectId(estudianteId);

    // Verificar si ya existe interacción (usando ObjectIds)
    const interaccionExistente = await InteractionModel.findOne({
      usuarioId: userIdObjectId,
      estudianteId: estudianteIdObjectId
    });

    if (interaccionExistente) {
      res.status(409).json({ message: 'Ya interactuaste con este usuario' });
      return;
    }

    // Guardar interacción (usando ObjectIds)
    await InteractionModel.create({
      usuarioId: userIdObjectId,
      estudianteId: estudianteIdObjectId,
      tipo: tipo
    });

    // Si es "dislike", solo devolver confirmación
    if (tipo === 'dislike') {
      res.status(200).json({
        message: 'Interacción registrada',
        match: false
      });
      return;
    }

    // Si es "like", verificar si hay match (usando ObjectIds)
    const interaccionRecíproca = await InteractionModel.findOne({
      usuarioId: estudianteIdObjectId,
      estudianteId: userIdObjectId,
      tipo: 'like'
    });

    if (interaccionRecíproca) {
      // Hay match! Verificar si ya existe el match (usando ObjectIds)
      const matchExistente = await MatchModel.findOne({
        $or: [
          { usuario1Id: userIdObjectId, usuario2Id: estudianteIdObjectId },
          { usuario1Id: estudianteIdObjectId, usuario2Id: userIdObjectId }
        ]
      });

      if (!matchExistente) {
        // Crear match (usando ObjectIds)
        const newMatch = await MatchModel.create({
          usuario1Id: userIdObjectId,
          usuario2Id: estudianteIdObjectId,
          estado: 'activo'
        });

        res.status(200).json({
          message: '¡Match!',
          match: true,
          matchData: {
            id: newMatch._id,
            estudiante: {
              id: estudiante._id,
              nombre: estudiante.nombre,
              apellido: estudiante.apellido,
              fotoPerfil: getImageUrl(estudiante.fotoPerfil, req),
              descripcion: estudiante.descripcion,
              carrera: estudiante.carrera,
              sede: estudiante.sede,
              edad: estudiante.edad,
              intereses: estudiante.intereses,
            },
            createdAt: newMatch.createdAt
          }
        });
        return;
      }
    }

    // No hay match
    res.status(200).json({
      message: 'Interacción registrada',
      match: false
    });
  } catch (error) {
    console.error('Error en swipe:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// GET /api/matches
export async function getMatches(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    // Convertir userId a ObjectId para consistencia
    const userIdObjectId = new mongoose.Types.ObjectId(userId);

    // Buscar matches del usuario - solo activos
    const matches = await MatchModel.find({
      $or: [
        { usuario1Id: userIdObjectId },
        { usuario2Id: userIdObjectId }
      ],
      estado: 'activo'
    }).sort({ createdAt: -1 });

    // Obtener información de los otros usuarios y filtrar si están inactivos
    const matchesResponse = await Promise.all(
      matches.map(async (match) => {
        // Comparar ObjectIds directamente para consistencia
        const otroUsuarioId = match.usuario1Id.equals(userIdObjectId) 
          ? match.usuario2Id 
          : match.usuario1Id;

        const otroUsuario = await UsuarioModel.findById(otroUsuarioId);

        // Si el otro usuario está inactivo, filtrar este match
        if (!otroUsuario || !otroUsuario.activo) {
          return null;
        }

        return {
          id: match._id,
          estudiante: {
            id: otroUsuario._id,
            nombre: otroUsuario.nombre,
            apellido: otroUsuario.apellido,
            fotoPerfil: getImageUrl(otroUsuario.fotoPerfil, req),
            descripcion: otroUsuario.descripcion,
            carrera: otroUsuario.carrera,
            sede: otroUsuario.sede,
            edad: otroUsuario.edad,
            intereses: otroUsuario.intereses,
          },
          createdAt: match.createdAt
        };
      })
    );

    // Filtrar nulls (matches con usuarios inactivos)
    const matchesValidos = matchesResponse.filter(m => m !== null);

    res.status(200).json({
      matches: matchesValidos,
      total: matchesValidos.length
    });
  } catch (error) {
    console.error('Error en getMatches:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export const getFilteredProfiles = async (req: Request, res: Response) => {
  try {
    // ID del usuario logueado (tu middleware la suele poner en req.userId)
    const userId = (req as any).userId;

    const {
      sede,
      carrera,
      edadMin,
      edadMax,
      interes, // un interés concreto
      q,       // búsqueda de texto (nombre / apellido / descripción)
      page = '1',
      limit = '20',
    } = req.query;

    const filtros: any = {
      activo: true,
    };

    // No mostrarte a vos mismo
    if (userId) {
      filtros._id = { $ne: userId };
    }

    if (sede) filtros.sede = sede;
    if (carrera) filtros.carrera = carrera;

    if (edadMin || edadMax) {
      filtros.edad = {};
      if (edadMin) filtros.edad.$gte = Number(edadMin);
      if (edadMax) filtros.edad.$lte = Number(edadMax);
    }

    if (interes) {
      filtros.intereses = { $in: [interes] }; // coincide con al menos ese interés
    }

    if (q) {
      const regex = new RegExp(String(q), 'i');
      filtros.$or = [
        { nombre: regex },
        { apellido: regex },
        { descripcion: regex },
      ];
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [usuarios, total] = await Promise.all([
      UsuarioModel.find(filtros)
        .sort({ createdAt: -1 }) // opcional: los más nuevos primero
        .skip(skip)
        .limit(limitNum),
      UsuarioModel.countDocuments(filtros),
    ]);

    const perfiles = usuarios.map(u => ({
      id: u._id,
      nombre: u.nombre,
      apellido: u.apellido,
      descripcion: u.descripcion,
      fotoPerfil: getImageUrl(u.fotoPerfil, req),
      carrera: u.carrera,
      sede: u.sede,
      edad: u.edad,
      intereses: u.intereses,
      createdAt: u.createdAt,
    }));

    res.status(200).json({
      message: 'Perfiles obtenidos con filtros',
      perfiles,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error en getFilteredProfiles:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}
// GET /api/discover/filters
export async function getFilterOptions(req: Request, res: Response): Promise<void> {
  try {
    // Solo usuarios activos
    const [carreras, sedes] = await Promise.all([
      UsuarioModel.distinct('carrera', { activo: true }),
      UsuarioModel.distinct('sede', { activo: true }),
    ]);

    res.status(200).json({
      carreras,
      sedes,
    });
  } catch (error) {
    console.error('Error en getFilterOptions:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}
// GET /api/discover/likes
export async function getLikeHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const userIdObjectId = new mongoose.Types.ObjectId(userId);

    // Todas las interacciones like realizadas por este usuario (más recientes primero)
    const likes = await InteractionModel.find({
      usuarioId: userIdObjectId,
      tipo: 'like',
    })
      .sort({ createdAt: -1 })
      .lean();

    if (likes.length === 0) {
      res.status(200).json({
        likes: [],
        total: 0,
      });
      return;
    }

    // Obtener los ids de los estudiantes likeados
    const estudianteIds = Array.from(
      new Set(
        likes
          .map(like => like.estudianteId)
          .filter(id => id && mongoose.Types.ObjectId.isValid(id))
          .map(id => new mongoose.Types.ObjectId(id as any).toString())
      )
    ).map(idStr => new mongoose.Types.ObjectId(idStr));

    // Traer los usuarios correspondientes
    const usuarios = await UsuarioModel.find({
      _id: { $in: estudianteIds },
      activo: true, // solo cuentas activas
    });

    // Armar un map para acceder rápido por id
    const usuariosMap = new Map(
      usuarios.map(u => [u._id.toString(), u])
    );

    // Armar respuesta respetando el orden de los likes
    const likesResponse = likes
      .map(like => {
        const u = usuariosMap.get(String(like.estudianteId));
        if (!u) return null;

        return {
          id: like._id,
          createdAt: like.createdAt,
          estudiante: {
            id: u._id,
            nombre: u.nombre,
            apellido: u.apellido,
            fotoPerfil: getImageUrl(u.fotoPerfil, req),
            descripcion: u.descripcion,
            carrera: u.carrera,
            sede: u.sede,
            edad: u.edad,
            intereses: u.intereses,
          },
        };
      })
      .filter(item => item !== null);

    res.status(200).json({
      likes: likesResponse,
      total: likesResponse.length,
    });
  } catch (error) {
    console.error('Error en getLikeHistory:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

;