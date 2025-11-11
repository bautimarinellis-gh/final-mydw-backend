import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import discoverRoutes from './routes/discoverRoutes';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error('Configura MONGO_URI en tu archivo .env');
}

const MONGO_URI = mongoUri;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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


async function start(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB conectado');

  app.listen(PORT, () => {
    console.log(`Servidor listo en http://localhost:${PORT}`);
  });
}

void start().catch((error) => {
  console.error('No se pudo iniciar el backend:', error);
  process.exit(1);
});

