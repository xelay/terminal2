 import { Router, Request, Response } from 'express';
import { pool } from '../db';
import jwt from 'jsonwebtoken';

export const userRouter = Router();

// Простейший Middleware для защиты роутов
const authenticateJWT = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
      if (err) return res.sendStatus(403);
      (req as any).user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

userRouter.use(authenticateJWT);

// Получить настройки терминала
userRouter.get('/workspace', async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const result = await pool.query('SELECT state_json FROM workspaces WHERE user_id = $1 LIMIT 1', [userId]);
    if (result.rows.length > 0) {
      res.json(result.rows[0].state_json);
    } else {
      res.json({});
    }
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// Сохранить текущее состояние графика
userRouter.put('/workspace', async (req, res) => {
  const userId = (req as any).user.id;
  const stateJson = req.body; // Получаем стейт Zustand из фронта

  try {
    await pool.query(
      `UPDATE workspaces SET state_json = $1, updated_at = now() WHERE user_id = $2`,
      [JSON.stringify(stateJson), userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

