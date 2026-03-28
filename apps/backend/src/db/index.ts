 import { Pool } from 'pg';

// Создаем пул подключений к базе данных.
// Он автоматически подхватит DATABASE_URL из вашего docker-compose.yml
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Добавляем обработчик ошибок, чтобы приложение не падало тихо
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Ошибка подключения к базе данных:', err.message);
  } else {
    console.log('✅ Успешно подключено к базе данных PostgreSQL! Текущее время БД:', res.rows[0].now);
  }
});

