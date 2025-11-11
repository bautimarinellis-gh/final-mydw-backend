import cors from 'cors';
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'university-match-api' });
});

async function bootstrap() {
  // TODO: Inicializar conexión con MongoDB (mongoose/mongo client).
  // Ejemplo:
  // await mongoose.connect(process.env.MONGODB_URI ?? '');

  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

void bootstrap();