# PROJECT CONTEXT: xelay/terminal2

> Этот документ — полное описание структуры проекта для передачи в LLM как контекст.
> Репозиторий: https://github.com/xelay/terminal2

---

## Общая архитектура

Проект организован как **монорепозиторий** со следующей структурой верхнего уровня:

```
terminal2/
├── .gitignore
├── README.md
├── CONTEXT.md              # этот файл — LLM-контекст проекта
├── apps/
│   ├── backend/            # Node.js/TypeScript сервер
│   └── frontend/           # React + Vite фронтенд
├── infra/                  # Инфраструктура (Docker, деплой)
└── packages/               # Общие пакеты монорепозитория
```

**Тип проекта:** Торговый терминал (trading terminal) с поддержкой нескольких бирж (Bybit, MOEX), real-time данными через WebSocket, аутентификацией через Google OAuth, хранением рисунков/аннотаций на графике и техническими индикаторами.

**Стек:** Node.js + TypeScript (backend), React + Vite + TypeScript (frontend), PostgreSQL (БД), WebSocket, Docker.

---

## Корневые файлы

| Файл | Описание |
|---|---|
| `.gitignore` | Исключения Git для Node.js-проектов (node_modules, dist, .env) |
| `README.md` | Минимальный (пустой), документация не заполнена |
| `CONTEXT.md` | Данный файл — описание проекта для LLM |

---

## apps/backend/

Backend-приложение на **Node.js + TypeScript**. Реализует REST API и WebSocket-сервер.

### Корневые файлы backend

| Файл | Размер | Описание |
|---|---|---|
| `Dockerfile` | 502 б | Docker-образ для сборки и запуска backend |
| `.dockerignore` | 2 б | Исключения при сборке Docker-образа |
| `package.json` | 929 б | Манифест проекта, зависимости, скрипты |
| `tsconfig.json` | 1234 б | Конфигурация TypeScript-компилятора |
| `swagger.ts` | 415 б | Скрипт генерации Swagger-документации |
| `swagger_output.json` | 3053 б | Сгенерированная OpenAPI/Swagger-документация API |

---

## apps/backend/src/

Основной исходный код backend.

```
src/
├── app.ts              # Инициализация Express-приложения
├── server.ts           # Точка входа, запуск HTTP + WS сервера
├── auth/               # Аутентификация (Google OAuth, JWT)
├── config/             # Конфигурация и ENV-переменные
├── db/                 # Подключение к PostgreSQL и миграции
├── drawings/           # CRUD рисунков/аннотаций на графике
├── exchanges/          # Интеграция с биржами (Bybit, MOEX)
├── indicators/         # Технические индикаторы (SMA, Volume)
├── market/             # Рыночные данные и исторические свечи
├── user/               # Управление пользователями
└── ws/                 # WebSocket-сервер
```

### server.ts
- **Точка входа** приложения (2260 б)
- Запускает HTTP-сервер, подключает роуты, middleware, WebSocket
- Инициализирует Swagger UI, passport, CORS, сессии

### app.ts
- Инициализация экземпляра Express-приложения
- Заглушка / реэкспорт (2 б)

---

## apps/backend/src/auth/

Модуль аутентификации.

| Файл | Размер | Описание |
|---|---|---|
| `passportGoogle.ts` | 2066 б | Google OAuth 2.0 стратегия через Passport.js. Находит/создаёт пользователя в БД, выдаёт JWT |
| `routes.ts` | 847 б | Express-роуты: `/auth/google`, `/auth/google/callback`, `/auth/logout` |
| `jwt.ts` | 2 б | Утилиты sign/verify для JWT-токенов |
| `middleware.ts` | 2 б | Express-middleware проверки JWT, защищает приватные роуты |

---

## apps/backend/src/config/

Конфигурация приложения. Содержит ENV-переменные: порты, ключи API, параметры БД, JWT-секреты, Google OAuth credentials.

---

## apps/backend/src/db/

Модуль работы с PostgreSQL.

| Файл | Размер | Описание |
|---|---|---|
| `index.ts` | 818 б | Инициализация pool/client PostgreSQL (через `pg`), экспорт для других модулей |
| `migrations/001_init.sql` | 2 б | Первоначальная SQL-миграция, создание базовых таблиц |

---

## apps/backend/src/drawings/

Модуль управления **рисунками/аннотациями на графике** (линии, уровни, фигуры).

| Файл | Описание |
|---|---|
| `routes.ts` | REST API роуты: GET/POST/PUT/DELETE `/drawings` |
| `serializer.ts` | Сериализация данных рисунков между форматами БД и фронтенда |

---

## apps/backend/src/exchanges/

Модуль интеграции с биржами. Паттерн **Adapter** для унификации работы с разными биржами.

| Файл | Размер | Описание |
|---|---|---|
| `types.ts` | 1023 б | TypeScript-типы: `IExchangeAdapter`, OHLCV-свечи, тикеры, стаканы |
| `ExchangeService.ts` | 718 б | Сервис-фасад: выбирает адаптер по имени биржи, делегирует вызовы |

### exchanges/adapters/

| Файл | Размер | Описание |
|---|---|---|
| `BaseAdapter.ts` | 2 б | Абстрактный базовый класс. Контракт: `getCandles()`, `getTicker()`, `getSymbols()` |
| `BybitAdapter.ts` | 2982 б | Адаптер для **Bybit** (крипто). HTTP-запросы к Bybit REST API v5 |
| `MoexAdapter.ts` | 3231 б | Адаптер для **MOEX** (Московская биржа). Интеграция с ISS MOEX API |

### exchanges/realtime/

| Файл | Описание |
|---|---|
| `RealtimeHub.ts` | Хаб управления real-time подписками. Координирует рассылку данных WebSocket-клиентам |
| `SmartPolling.ts` | Адаптивный поллинг API бирж, пушит обновления через RealtimeHub |

---

## apps/backend/src/indicators/

Вычисление технических индикаторов на стороне сервера.

| Файл | Описание |
|---|---|
| `types.ts` | TypeScript-типы: входные/выходные данные и параметры индикаторов |
| `sma.ts` | Реализация **SMA** (Simple Moving Average — простая скользящая средняя) |
| `volume.ts` | Индикатор объёма торгов (**Volume**) |

---

## apps/backend/src/market/

Агрегация рыночных данных от бирж и предоставление через API.

| Файл | Размер | Описание |
|---|---|---|
| `routes.ts` | 1079 б | REST API: `GET /market/candles`, `GET /market/symbols`, `GET /market/ticker` |
| `history/` | — | Подмодуль загрузки, кэширования и выдачи исторических свечей |

---

## apps/backend/src/user/

Модуль управления пользователями: профиль, настройки, привязанные аккаунты.

---

## apps/backend/src/ws/

WebSocket-сервер для real-time коммуникации с фронтендом.
- Обрабатывает подписки клиентов на символы/биржи
- Получает данные от `RealtimeHub` и рассылает подключённым клиентам
- Протокол подписки: `{ type: 'subscribe', exchange, symbol, interval }`

---

## apps/frontend/

Фронтенд-приложение на **React + Vite + TypeScript**.

### Корневые файлы frontend

| Файл | Размер | Описание |
|---|---|---|
| `Dockerfile` | 280 б | Docker-образ фронтенда (сборка + Nginx) |
| `nginx.conf` | 152 б | Конфигурация Nginx для раздачи статики |
| `index.html` | 411 б | HTML-точка входа Vite-приложения |
| `package.json` | 466 б | Зависимости и скрипты фронтенда |
| `tsconfig.json` | 558 б | Конфигурация TypeScript для фронтенда |
| `vite.config.ts` | 2 б | Конфигурация сборщика Vite |

---

## apps/frontend/src/

```
src/
├── main.tsx            # Точка входа React-приложения
├── vite-env.d.ts       # Типы Vite для TypeScript
├── app/                # Корневой компонент, роутер, тема
├── api/                # HTTP-клиент и API-методы
├── features/           # Фичи по доменам (chart, drawings, modals)
├── store/              # Глобальное состояние (Zustand/Jotai/Redux)
├── styles/             # Глобальные стили
└── ws/                 # WebSocket-клиент
```

### main.tsx
- Точка входа React-приложения (313 б)
- Монтирует `<App />` в DOM, оборачивает в провайдеры

---

## apps/frontend/src/app/

| Файл/Папка | Размер | Описание |
|---|---|---|
| `App.tsx` | 3496 б | Корневой компонент приложения. Layout, роутинг, инициализация |
| `router.ts` | 2 б | Конфигурация React Router — маршруты приложения |
| `theme/` | — | Тема оформления (цвета, типографика, тёмная/светлая тема) |

---

## apps/frontend/src/api/

HTTP-клиент и методы обращения к backend REST API.

| Файл | Описание |
|---|---|
| `http.ts` | Базовый HTTP-клиент (axios/fetch), обработка токенов, interceptors |
| `market.ts` | API-методы: получение свечей, символов, тикеров |
| `user.ts` | API-методы: профиль пользователя, настройки |

---

## apps/frontend/src/features/

### features/chart/

Главная фича — отображение торгового графика.

| Файл/Папка | Размер | Описание |
|---|---|---|
| `ChartView.tsx` | 9248 б | **Главный компонент графика**. Рендерит LWC-chart, управляет состоянием, связывает индикаторы и рисунки |
| `lwc/` | — | Обёртки над **Lightweight Charts** (TradingView) |
| `indicators/` | — | UI и логика технических индикаторов |

#### features/chart/lwc/

| Файл | Размер | Описание |
|---|---|---|
| `useLightweightChart.ts` | 2730 б | React-хук инициализации и управления Lightweight Charts |
| `createChart.ts` | 2 б | Фабрика создания экземпляра графика |
| `series.ts` | 2 б | Управление сериями данных (свечи, линии) |
| `realtime.ts` | 2 б | Подключение real-time обновлений к серии графика |
| `pagination.ts` | 2 б | Подгрузка исторических данных при скролле назад |

#### features/chart/indicators/

| Файл | Размер | Описание |
|---|---|---|
| `IndicatorsModal.tsx` | 3863 б | Модальное окно выбора и настройки индикаторов |
| `SMAForm.tsx` | 3245 б | Форма настройки параметров индикатора SMA |
| `VolumeForm.tsx` | 2 б | Форма настройки индикатора Volume |
| `registry.ts` | 671 б | Реестр доступных индикаторов — маппинг имя → компонент/конфиг |

### features/drawings/

Фича рисования аннотаций поверх графика.

| Файл/Папка | Размер | Описание |
|---|---|---|
| `CanvasOverlay.tsx` | 4935 б | Canvas-оверлей поверх графика для рисования. Обрабатывает mouse-события |
| `Toolbar.tsx` | 2 б | Панель инструментов рисования (выбор инструмента, цвет) |
| `tools/BrushTool.ts` | 2 б | Реализация инструмента «кисть» для свободного рисования |

### features/modals/

| Файл | Описание |
|---|---|
| `IndicatorsModal.tsx` | Модальное окно индикаторов (дублирует или реэкспортирует из `chart/indicators/`) |
| `SymbolSearchModal.tsx` | Модальное окно поиска торгового инструмента (символа/тикера) |

---

## apps/frontend/src/store/

Глобальное состояние приложения.

| Файл | Размер | Описание |
|---|---|---|
| `workspace.ts` | 3130 б | **Основной стор**: текущий символ, биржа, интервал, список панелей |
| `session.ts` | 2 б | Состояние сессии пользователя (авторизован / JWT-токен) |
| `persistence.ts` | 2 б | Логика сохранения/загрузки состояния в localStorage |

---

## apps/frontend/src/ws/

WebSocket-клиент для получения real-time данных.

| Файл | Описание |
|---|---|
| `socket.ts` | Инициализация WebSocket-соединения с backend, реконнект |
| `events.ts` | Типы и обработчики WS-событий: `candle_update`, `ticker_update` |

---

## apps/frontend/src/styles/

Глобальные CSS/SCSS стили приложения: сброс стилей, переменные, базовые стили.

---

## infra/

Инфраструктурные файлы: Docker Compose, конфигурации Nginx, CI/CD пайплайны, скрипты деплоя.

---

## packages/

Общие пакеты монорепозитория — shared-типы и утилиты, доступные как backend, так и frontend.

---

## Ключевые технологии

| Слой | Технология | Назначение |
|---|---|---|
| Backend runtime | Node.js + TypeScript | Сервер |
| Backend framework | Express.js | HTTP API |
| Аутентификация | Passport.js + Google OAuth 2.0 | Вход через Google |
| Авторизация | JWT | Защита роутов |
| База данных | PostgreSQL | Хранение данных |
| Real-time | WebSocket (ws) | Стриминг рыночных данных |
| Биржа (крипто) | Bybit REST API v5 | Данные по криптовалютам |
| Биржа (фондовый) | MOEX ISS API | Российский фондовый рынок |
| API-документация | Swagger / OpenAPI | Документация эндпоинтов |
| Frontend framework | React + TypeScript | UI |
| Сборщик | Vite | Разработка и сборка фронтенда |
| Графики | Lightweight Charts (TradingView) | Отображение свечных графиков |
| Контейнеризация | Docker + Nginx | Деплой |

---

## Основные потоки данных

1. **Аутентификация:** Пользователь → Google OAuth → `passportGoogle.ts` → создание/поиск в БД → JWT → клиент
2. **Рыночные данные (REST):** Клиент → `market/routes.ts` → `ExchangeService` → `BybitAdapter` / `MoexAdapter` → ответ JSON
3. **Real-time данные:** `SmartPolling` опрашивает биржу → `RealtimeHub` → `ws/` сервер → WebSocket → `ws/socket.ts` клиент → обновление графика
4. **Рисунки:** `CanvasOverlay.tsx` → `api/` → `drawings/routes.ts` → PostgreSQL → синхронизация между сессиями
5. **Исторические свечи:** `useLightweightChart.ts` (скролл назад) → `lwc/pagination.ts` → `api/market.ts` → `market/history/` → биржевой адаптер

---

*Документ сгенерирован на основе анализа структуры репозитория [xelay/terminal2](https://github.com/xelay/terminal2)*
