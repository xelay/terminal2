import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import passport from 'passport';

import { marketRouter } from './market/routes';
import { authRouter } from './auth/routes';
import { userRouter } from './user/routes';
import { drawingsRouter } from './drawings/routes';
import { setupWebSockets } from './ws/socket';
import './auth/passportGoogle';

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';

const app = express();

const swaggerFile = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../swagger_output.json'), 'utf-8'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

app.use(express.json({ limit: '2mb' }));
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(passport.initialize());

app.use('/api/market', marketRouter);
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/drawings', drawingsRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'], credentials: true },
});

setupWebSockets(io);

httpServer.listen(PORT, () => {
  console.log(`🚀 Backend is running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  httpServer.close(() => { process.exit(0); });
});
