 
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { pool } from '../db';
import { v4 as uuidv4 } from 'uuid';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: process.env.GOOGLE_CALLBACK_URL!
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const providerId = profile.id;
    const email = profile.emails![0].value;

    // 1. Ищем, есть ли уже этот Google аккаунт
    let result = await pool.query('SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2', ['google', providerId]);
    
    if (result.rows.length > 0) {
      // Пользователь найден, возвращаем ID
      return done(null, { id: result.rows[0].user_id });
    }

    // 2. Иначе создаем нового пользователя в транзакции
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userId = uuidv4();
      
      await client.query(
        'INSERT INTO users (id, email, display_name, avatar_url) VALUES ($1, $2, $3, $4)',
        [userId, email, profile.displayName, profile.photos?.[0].value]
      );

      await client.query(
        'INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id) VALUES ($1, $2, $3, $4)',
        [uuidv4(), userId, 'google', providerId]
      );

      // Инициализируем дефолтный workspace
      await client.query(
        `INSERT INTO workspaces (id, user_id, name, state_json) VALUES ($1, $2, 'Default', '{"exchange":"bybit","symbol":"BTC/USDT","timeframe":"15m","indicators":[]}')`,
        [uuidv4(), userId]
      );

      await client.query('COMMIT');
      return done(null, { id: userId });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return done(error as Error, undefined);
  }
}));
