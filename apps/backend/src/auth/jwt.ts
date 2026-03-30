import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

export function signToken(payload: object): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): any {
  return jwt.verify(token, SECRET);
}
