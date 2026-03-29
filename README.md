# terminal2

Торговый терминал с поддержкой нескольких бирж (быстрые криптобиржи и MOEX), real-time графиками, индикаторами, рисованием на графике и аутентификацией через Google.

> 📌 **Полное описание структуры проекта, всех файлов и потоков данных находится в [`CONTEXT.md`](./CONTEXT.md)** — используйте его как контекст при работе с LLM (ChatGPT, Claude, Cursor, Copilot).

---

## Стек

| Слой | Технология |
|---|---|
| Frontend | React + TypeScript + Vite |
| Графики | TradingView Lightweight Charts |
| Backend | Node.js + TypeScript + Express |
| Аутентификация | Google OAuth 2.0 + JWT |
| База данных | PostgreSQL |
| Real-time | WebSocket |
| Биржи | Bybit API v5, MOEX ISS API |
| Инфра | Docker + Nginx |

---

## Функциональность

- Свечные графики с real-time обновлением через WebSocket
- Поддержка нескольких бирж: **Bybit** (крипто) и **MOEX** (российский фондовый рынок)
- Технические индикаторы: SMA, Volume
- Рисование аннотаций поверх графика с сохранением в PostgreSQL
- Аутентификация через Google OAuth, персональные настройки хранятся на backend
- Подгрузка исторических данных при скролле назад (пагинация)
- REST API с Swagger-документацией

---

## Структура монорепозитория

```
terminal2/
├── apps/
│   ├── backend/      # Node.js/TypeScript — REST API + WebSocket-сервер
│   └── frontend/     # React + Vite — интерфейс терминала
├── infra/          # Docker Compose, Nginx, деплой
├── packages/       # Общие shared-пакеты
├── CONTEXT.md      # Подробное описание всех файлов для LLM
└── README.md
```

> Подробный разбор каждой директории и файла — в **[→ CONTEXT.md](./CONTEXT.md)**

---

## Быстрый старт

### Требования

- Node.js ≥ 18
- Docker + Docker Compose
- PostgreSQL 15+

### Запуск через Docker

```bash
git clone https://github.com/xelay/terminal2.git
cd terminal2
cp .env.example .env   # заполните переменные
docker compose up --build
```

### Локальная разработка

```bash
# Backend
cd apps/backend
npm install
npm run dev

# Frontend
cd apps/frontend
npm install
npm run dev
```

### Переменные окружения (`.env`)

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Секрет для подписи JWT-токенов |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret |
| `GOOGLE_CALLBACK_URL` | URL коллбэка после аутентификации |
| `VITE_WS_URL` | URL WebSocket-сервера для фронтенда |

---

## API-документация

Swagger UI доступен после запуска backend по адресу:

```
http://localhost:3000/api-docs
```

---

## Для LLM-ассистентов

Если вы работаете с этим проектом через AI-инструменты (ChatGPT, Claude, Cursor, GitHub Copilot) — передайте содержимое файла **[CONTEXT.md](./CONTEXT.md)** как системный промпт.

Файл содержит:
- Полное дерево файлов с описанием каждого
- Таблицу технологий стека
- Основные потоки данных (аутентификация, REST, WebSocket, рисунки)
