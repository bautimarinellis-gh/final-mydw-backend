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
  process.env.FRONTEND_URL, // Frontend de producción (desde variable de entorno)
].filter(Boolean) as string[]; // Filtra valores undefined/null

app.use(cors({
  origin: (origin, callback) => {
    // Permite requests sin origen (como móvil apps o curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
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
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB conectado');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor listo en http://0.0.0.0:${PORT}`);
  });
}

void start().catch((error) => {
  console.error('No se pudo iniciar el backend:', error);
  process.exit(1);
});

