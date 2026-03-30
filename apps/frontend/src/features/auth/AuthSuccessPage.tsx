import React, { useEffect } from 'react';
import { useSessionStore } from '../../store/session';

/**
 * Страница /auth/success?token=...
 * Бэкенд редиректит сюда после Google OAuth.
 * Достаём токен из URL, сохраняем, редиректим на главную.
 */
export const AuthSuccessPage: React.FC = () => {
  const login = useSessionStore(s => s.login);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      login(token);
    }
    // Убираем токен из адресной строки и идём на главную
    window.history.replaceState({}, '', '/');
    window.location.href = '/';
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#131722', color: '#d1d4dc', fontSize: 16,
    }}>
      Выполняем вход...
    </div>
  );
};
