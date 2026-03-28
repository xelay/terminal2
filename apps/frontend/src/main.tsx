import React from 'react'
import ReactDOM from 'react-dom/client'
// Импортируем тот самый App, который мы нашли
import { App } from './app/App' 

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
