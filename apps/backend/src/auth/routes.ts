 import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';

export const authRouter = Router();

authRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

authRouter.get('/google/callback', 
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    // Пользователь авторизован, генерируем JWT
    const user = req.user as any;
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    // Отправляем на фронт (в примере передаем через query параметр, но в проде лучше использовать HttpOnly Cookie)
    res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
  }
);

