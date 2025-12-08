/**
 * index.ts - Punto de entrada principal del servidor backend.
 * Configura Express, MongoDB, CORS, Socket.IO, middlewares y rutas de la API REST.
 */

import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import path from 'path';
import http from 'http';
import authRoutes from './routes/authRoutes';
import discoverRoutes from './routes/discoverRoutes';
import chatRoutes from './routes/chatRoutes';
import { getUsuarios } from './controllers/usuarioController';
import { initializeSocketIO } from './socket/socketServer';
import { setupSocketHandlers } from './socket/socketHandlers';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const mongoUri = process.env.MONGO_URI;

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

if (!mongoUri) {
  throw new Error('Configura MONGO_URI en tu archivo .env');
}

const MONGO_URI = mongoUri;

const allowedOrigins = [
  'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://final-mydw-frontend.onrender.com',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

if (process.env.NODE_ENV === 'production') {
  console.log('Orígenes permitidos por CORS:', allowedOrigins);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Origen no permitido: ${origin}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/uploads/images', express.static(path.join(process.cwd(), 'uploads', 'images')));

app.get('/', (_req: Request, res: Response) => {
  res.send('Hola Mundo');
});

app.get('/api/usuarios', getUsuarios);

app.use('/api/auth', authRoutes);

app.use('/api/discover', discoverRoutes);

app.use('/api/chat', chatRoutes);


async function start(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB conectado');
  } catch (error) {
    console.error('Error al conectar con MongoDB:', error);
    throw error;
  }

  const httpServer = http.createServer(app);

  const io = initializeSocketIO(httpServer, allowedOrigins);
  
  setupSocketHandlers(io);

  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
  
  httpServer.listen(PORT, host, () => {
    console.log(`Servidor listo en http://${host}:${PORT}`);
    console.log('WebSocket habilitado en Socket.io');
  });
}

void start().catch((error) => {
  console.error('No se pudo iniciar el backend:', error);
  process.exit(1);
});

