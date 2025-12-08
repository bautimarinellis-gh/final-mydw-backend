/**
 * chatController.ts - Controlador de chat y mensajería en tiempo real.
 * Gestiona conversaciones, mensajes y actualización de estado de leídos entre usuarios con match activo.
 */

import { Request, Response } from 'express';
import { MatchModel } from '../models/matchSchema';
import { MessageModel } from '../models/messageSchema';
import { UsuarioModel } from '../models/usuarioSchema';
import { emitirMensajeNuevo } from '../socket/socketHandlers';

async function validarMatch(userId: string, matchId: string, otroUsuarioId: string): Promise<boolean> {
  const match = await MatchModel.findById(matchId);
  
  if (!match) return false;
  if (match.estado !== 'activo') return false;
  
  const esUsuario1 = match.usuario1Id.toString() === userId;
  const esUsuario2 = match.usuario2Id.toString() === userId;
  if (!esUsuario1 && !esUsuario2) return false;
  
  const otroEsUsuario1 = match.usuario1Id.toString() === otroUsuarioId;
  const otroEsUsuario2 = match.usuario2Id.toString() === otroUsuarioId;
  if (!otroEsUsuario1 && !otroEsUsuario2) return false;
  
  return true;
}

export async function getConversaciones(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const matches = await MatchModel.find({
      $or: [
        { usuario1Id: userId },
        { usuario2Id: userId }
      ],
      estado: 'activo'
    });

    const conversaciones = await Promise.all(
      matches.map(async (match) => {
        const otroUsuarioId = match.usuario1Id.toString() === userId 
          ? match.usuario2Id 
          : match.usuario1Id;

        const otroUsuario = await UsuarioModel.findById(otroUsuarioId);
        
        if (!otroUsuario || !otroUsuario.activo) {
          return null;
        }
        
        const ultimoMensaje = await MessageModel.findOne({ matchId: match._id })
          .sort({ createdAt: -1 })
          .limit(1);

        const mensajesNoLeidos = await MessageModel.countDocuments({
          matchId: match._id,
          destinatarioId: userId,
          leido: false
        });

        return {
          matchId: match._id,
          usuario: {
            id: otroUsuario._id,
            nombre: otroUsuario.nombre,
            apellido: otroUsuario.apellido,
            descripcion: otroUsuario.descripcion,
            carrera: otroUsuario.carrera,
            sede: otroUsuario.sede,
            edad: otroUsuario.edad,
            intereses: otroUsuario.intereses,
          },
          ultimoMensaje: ultimoMensaje ? {
            contenido: ultimoMensaje.contenido,
            remitenteId: ultimoMensaje.remitenteId,
            createdAt: ultimoMensaje.createdAt
          } : null,
          mensajesNoLeidos,
          updatedAt: ultimoMensaje?.createdAt || match.createdAt
        };
      })
    );

    const conversacionesValidas = conversaciones
      .filter(c => c !== null)
      .sort((a, b) => {
        const dateA = a!.updatedAt as Date;
        const dateB = b!.updatedAt as Date;
        return dateB.getTime() - dateA.getTime();
      });

    res.status(200).json({
      conversaciones: conversacionesValidas
    });
  } catch (error) {
    console.error('Error en getConversaciones:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function getConversacion(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    const { matchId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string;

    if (!userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    // Verificar que el match existe y el usuario es parte de él
    const match = await MatchModel.findById(matchId);
    if (!match) {
      res.status(404).json({ message: 'Conversación no encontrada' });
      return;
    }

    if (match.estado !== 'activo') {
      res.status(403).json({ message: 'Esta conversación está bloqueada' });
      return;
    }

    const esUsuario1 = match.usuario1Id.toString() === userId;
    const esUsuario2 = match.usuario2Id.toString() === userId;
    
    if (!esUsuario1 && !esUsuario2) {
      res.status(403).json({ message: 'No tienes acceso a esta conversación' });
      return;
    }

    const otroUsuarioId = esUsuario1 ? match.usuario2Id : match.usuario1Id;
    const otroUsuario = await UsuarioModel.findById(otroUsuarioId);

    if (!otroUsuario) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    const query: any = { matchId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const mensajes = await MessageModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const mensajesOrdenados = mensajes.reverse();
    const total = await MessageModel.countDocuments({ matchId });

    res.status(200).json({
      matchId,
      usuario: {
        id: otroUsuario._id,
        nombre: otroUsuario.nombre,
        apellido: otroUsuario.apellido,
        descripcion: otroUsuario.descripcion,
        carrera: otroUsuario.carrera,
        sede: otroUsuario.sede,
        edad: otroUsuario.edad,
        intereses: otroUsuario.intereses,
      },
      mensajes: mensajesOrdenados.map(m => ({
        id: m._id,
        contenido: m.contenido,
        remitenteId: m.remitenteId,
        destinatarioId: m.destinatarioId,
        leido: m.leido,
        createdAt: m.createdAt
      })),
      total
    });
  } catch (error) {
    console.error('Error en getConversacion:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function enviarMensaje(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    const { matchId, destinatarioId, contenido } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    if (!matchId || !destinatarioId || !contenido) {
      res.status(400).json({ message: 'matchId, destinatarioId y contenido son requeridos' });
      return;
    }

    if (typeof contenido !== 'string' || contenido.trim() === '') {
      res.status(400).json({ message: 'El contenido no puede estar vacío' });
      return;
    }

    if (contenido.length > 1000) {
      res.status(400).json({ message: 'El mensaje no puede exceder 1000 caracteres' });
      return;
    }

    if (userId === destinatarioId) {
      res.status(400).json({ message: 'No puedes enviarte mensajes a ti mismo' });
      return;
    }

    const matchValido = await validarMatch(userId, matchId, destinatarioId);
    if (!matchValido) {
      res.status(403).json({ message: 'No tienes permiso para enviar mensajes en esta conversación' });
      return;
    }

    const nuevoMensaje = await MessageModel.create({
      remitenteId: userId,
      destinatarioId,
      matchId,
      contenido: contenido.trim(),
      leido: false
    });

    const mensajePayload = {
      id: nuevoMensaje._id.toString(),
      contenido: nuevoMensaje.contenido,
      remitenteId: nuevoMensaje.remitenteId.toString(),
      destinatarioId: nuevoMensaje.destinatarioId.toString(),
      matchId: nuevoMensaje.matchId.toString(),
      leido: nuevoMensaje.leido,
      createdAt: nuevoMensaje.createdAt
    };

    emitirMensajeNuevo(mensajePayload, destinatarioId, matchId);

    res.status(201).json({
      message: 'Mensaje enviado',
      mensaje: {
        id: nuevoMensaje._id,
        contenido: nuevoMensaje.contenido,
        remitenteId: nuevoMensaje.remitenteId,
        destinatarioId: nuevoMensaje.destinatarioId,
        matchId: nuevoMensaje.matchId,
        leido: nuevoMensaje.leido,
        createdAt: nuevoMensaje.createdAt
      }
    });
  } catch (error) {
    console.error('Error en enviarMensaje:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

export async function marcarMensajesLeidos(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    const { matchId } = req.params;

    if (!userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    // Verificar que el match existe y el usuario es parte de él
    const match = await MatchModel.findById(matchId);
    if (!match) {
      res.status(404).json({ message: 'Conversación no encontrada' });
      return;
    }

    const esUsuario1 = match.usuario1Id.toString() === userId;
    const esUsuario2 = match.usuario2Id.toString() === userId;
    
    if (!esUsuario1 && !esUsuario2) {
      res.status(403).json({ message: 'No tienes acceso a esta conversación' });
      return;
    }

    const resultado = await MessageModel.updateMany(
      {
        matchId,
        destinatarioId: userId,
        leido: false
      },
      {
        leido: true
      }
    );

    res.status(200).json({
      message: 'Mensajes marcados como leídos',
      cantidad: resultado.modifiedCount
    });
  } catch (error) {
    console.error('Error en marcarMensajesLeidos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

