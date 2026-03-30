import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const payload = verifyToken(header.slice(7));
    (req as any).user = payload;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}
