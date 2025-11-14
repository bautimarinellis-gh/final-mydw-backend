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

if (!mongoUri) {
  throw new Error('Configura MONGO_URI en tu archivo .env');
}

const MONGO_URI = mongoUri;

// Configuración de CORS
const allowedOrigins = [
  'http://localhost:5174', // Frontend de desarrollo
  'http://localhost:5173', // Frontend alternativo de desarrollo
  'http://localhost:3000', // Frontend alternativo de desarrollo
  'https://final-mydw-frontend.onrender.com', // Frontend de producción en Render
  process.env.FRONTEND_URL, // Frontend de producción (desde variable de entorno)
].filter(Boolean) as string[]; // Filtra valores undefined/null

// Log para debugging en producción
if (process.env.NODE_ENV === 'production') {
  console.log('Orígenes permitidos por CORS:', allowedOrigins);
}

app.use(cors({
  origin: (origin, callback) => {
    // Permite requests sin origen (como móvil apps, Postman, o curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // En desarrollo, permite cualquier localhost
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
      return callback(null, true);
    }
    
    // En producción, verifica contra la lista de orígenes permitidos
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

// Servir archivos estáticos desde uploads/images
app.use('/api/uploads/images', express.static(path.join(process.cwd(), 'uploads', 'images')));

app.get('/', (_req: Request, res: Response) => {
  res.send('Hola Mundo');
});

// Ruta pública para obtener usuarios (SIN autenticación)
app.get('/api/usuarios', getUsuarios);

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas de descubrimiento y matches
app.use('/api/discover', discoverRoutes);

// Rutas de chat
app.use('/api/chat', chatRoutes);


async function start(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB conectado');
  } catch (error) {
    console.error('Error al conectar con MongoDB:', error);
    throw error;
  }

  // Crear servidor HTTP para Express y Socket.io
  const httpServer = http.createServer(app);

  // Inicializar Socket.io
  const io = initializeSocketIO(httpServer, allowedOrigins);
  
  // Configurar handlers de Socket.io
  setupSocketHandlers(io);

  // En desarrollo usar localhost, en producción 0.0.0.0 (necesario para Render)
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

