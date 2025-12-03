import { Request, Response } from 'express';
import { UsuarioModel } from '../models/usuarioSchema';
import { InteractionModel } from '../models/interactionSchema';
import { MatchModel } from '../models/matchSchema';
import mongoose from 'mongoose';
import { getImageUrl } from '../utils/fileUtils';

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

    // Buscar usuarios (con o sin filtros según si hay userId)
    const query = excluirIds.length > 0 
      ? { _id: { $nin: excluirIds } }
      : {};

    // Excluir usuarios desactivados
    const finalQuery = query && Object.keys(query).length > 0 ? { ...query, activo: true } : { activo: true };
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

