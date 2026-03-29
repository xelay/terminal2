import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';

export const drawingsRouter = Router();

// JWT middleware (аналогично user/routes.ts)
const authenticateJWT = (req: Request, res: Response, next: Function) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) return res.sendStatus(403);
    (req as any).user = user;
    next();
  });
};

drawingsRouter.use(authenticateJWT);

// GET /api/drawings?exchange=bybit&symbol=ETH/USDT&timeframe=1d
drawingsRouter.get('/', async (req, res) => {
  const userId = (req as any).user.id;
  const { exchange, symbol, timeframe } = req.query;
  try {
    const result = await pool.query(
      `SELECT id, type, data, created_at FROM drawings
       WHERE user_id=$1 AND exchange=$2 AND symbol=$3 AND timeframe=$4
       ORDER BY created_at ASC`,
      [userId, exchange, symbol, timeframe],
    );
    res.json({ drawings: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST /api/drawings  { exchange, symbol, timeframe, type, data }
drawingsRouter.post('/', async (req, res) => {
  const userId = (req as any).user.id;
  const { exchange, symbol, timeframe, type = 'brush', data } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO drawings (user_id, exchange, symbol, timeframe, type, data)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
      [userId, exchange, symbol, timeframe, type, JSON.stringify(data)],
    );
    res.json({ id: result.rows[0].id, created_at: result.rows[0].created_at });
  } catch (e) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// DELETE /api/drawings/:id
drawingsRouter.delete('/:id', async (req, res) => {
  const userId = (req as any).user.id;
  try {
    await pool.query(
      `DELETE FROM drawings WHERE id=$1 AND user_id=$2`,
      [req.params.id, userId],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'DB Error' });
  }
});
