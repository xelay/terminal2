import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import passport from 'passport';

// Импорт роутов и модулей
import { marketRouter } from './market/routes';
import { authRouter } from './auth/routes';
import { userRouter } from './user/routes';
import { setupWebSockets } from './ws/socket';
import './auth/passportGoogle'; // Инициализация стратегии



// Конфиг
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';

const app = express();

// Читаем сгенерированный файл
const swaggerFile = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../swagger_output.json'), 'utf-8'));

// Подключаем UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Базовые middleware
app.use(express.json());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(passport.initialize());

// Маршрутизация REST
app.use('/api/market', marketRouter);
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);

// Обработка 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Создаем единый HTTP-сервер для Express и WebSockets
const httpServer = createServer(app);

// Инициализация Socket.io поверх httpServer
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Подключаем логику комнат и стриминга свечей
setupWebSockets(io);

// Запуск
httpServer.listen(PORT, () => {
  console.log(`🚀 Backend is running on http://localhost:${PORT}`);
});

// Graceful Shutdown: корректное закрытие соединений при остановке контейнера
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

