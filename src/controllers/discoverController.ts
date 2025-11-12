import { Request, Response } from 'express';
import { UsuarioModel } from '../models/usuarioSchema';
import { InteractionModel } from '../models/interactionSchema';
import { MatchModel } from '../models/matchSchema';
import mongoose from 'mongoose';

// GET /api/discover/next
export async function getNextProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId; // Puede ser undefined si no está autenticado

    let excluirIds: string[] = [];

    // Si hay usuario autenticado, aplicar filtros para excluir usuarios ya interactuados
    if (userId) {
      // Obtener IDs de usuarios ya interactuados
      const interacciones = await InteractionModel.find({ usuarioId: userId }).select('estudianteId');
      const interactuadosIds = interacciones.map(i => i.estudianteId);

      // Obtener IDs de usuarios con match
      const matches = await MatchModel.find({
        $or: [
          { usuario1Id: userId },
          { usuario2Id: userId }
        ]
      });
      const matcheadosIds = matches.map(m => 
        m.usuario1Id.toString() === userId ? m.usuario2Id : m.usuario1Id
      );

      // Combinar IDs a excluir
      excluirIds = [
        ...interactuadosIds.map(id => id.toString()),
        ...matcheadosIds.map(id => id.toString()),
        userId
      ];
    }

    // Buscar usuarios (con o sin filtros según si hay userId)
    const query = excluirIds.length > 0 
      ? { _id: { $nin: excluirIds } }
      : {};

    const estudiantes = await UsuarioModel.find(query);

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
        fotoPerfil: estudiante.fotoPerfil,
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

    // Verificar si ya existe interacción
    const interaccionExistente = await InteractionModel.findOne({
      usuarioId: userId,
      estudianteId: estudianteId
    });

    if (interaccionExistente) {
      res.status(409).json({ message: 'Ya interactuaste con este usuario' });
      return;
    }

    // Guardar interacción
    await InteractionModel.create({
      usuarioId: userId,
      estudianteId: estudianteId,
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

    // Si es "like", verificar si hay match
    const interaccionRecíproca = await InteractionModel.findOne({
      usuarioId: estudianteId,
      estudianteId: userId,
      tipo: 'like'
    });

    if (interaccionRecíproca) {
      // Hay match! Verificar si ya existe el match (por las dudas)
      const matchExistente = await MatchModel.findOne({
        $or: [
          { usuario1Id: userId, usuario2Id: estudianteId },
          { usuario1Id: estudianteId, usuario2Id: userId }
        ]
      });

      if (!matchExistente) {
        // Crear match
        const newMatch = await MatchModel.create({
          usuario1Id: userId,
          usuario2Id: estudianteId,
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
              fotoPerfil: estudiante.fotoPerfil,
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

    // Buscar matches del usuario
    const matches = await MatchModel.find({
      $or: [
        { usuario1Id: userId },
        { usuario2Id: userId }
      ],
      estado: 'activo'
    }).sort({ createdAt: -1 });

    // Obtener información de los otros usuarios
    const matchesResponse = await Promise.all(
      matches.map(async (match) => {
        const otroUsuarioId = match.usuario1Id.toString() === userId 
          ? match.usuario2Id 
          : match.usuario1Id;

        const otroUsuario = await UsuarioModel.findById(otroUsuarioId);

        if (!otroUsuario) {
          return null;
        }

        return {
          id: match._id,
          estudiante: {
            id: otroUsuario._id,
            nombre: otroUsuario.nombre,
            apellido: otroUsuario.apellido,
            fotoPerfil: otroUsuario.fotoPerfil,
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

    // Filtrar nulls (por si algún usuario fue eliminado)
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

