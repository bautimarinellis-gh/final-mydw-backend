import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import discoverRoutes from './routes/discoverRoutes';
import chatRoutes from './routes/chatRoutes';

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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(cookieParser());

app.get('/', (_req: Request, res: Response) => {
  res.send('Hola Mundo');
});

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor listo en http://0.0.0.0:${PORT}`);
  });
}

void start().catch((error) => {
  console.error('No se pudo iniciar el backend:', error);
  process.exit(1);
});

