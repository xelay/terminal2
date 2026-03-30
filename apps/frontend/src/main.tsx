import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { AuthSuccessPage } from './features/auth/AuthSuccessPage';

// Минимальный клиентский роутинг без react-router
const path = window.location.pathname;

let Root: React.FC;
if (path === '/auth/success') {
  Root = AuthSuccessPage;
} else {
  Root = App;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
