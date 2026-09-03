# Team Tasks — MVP

Полнофункциональное приложение для внутренней команды: ежедневные задачи,
роли, история, и система исходящих/входящих webhook-ов. Стек полностью
бесплатный/open-source (см. ниже) и рассчитан на деплой как **один сервис**
на Railway (backend раздаёт собранный frontend).

## Стек

- **Frontend:** React + TypeScript + Tailwind (Vite)
- **Backend:** Node.js + Express + TypeScript
- **DB:** PostgreSQL + Prisma ORM
- **Auth:** собственная система — bcrypt + JWT в HTTP-only cookie, без внешних сервисов
- **Webhooks:** свои исходящие webhook-и (HMAC-SHA256, retry с exponential backoff, логи) + свои входящие endpoint-ы
- **Cron:** `node-cron` внутри самого backend-процесса (без сторонних cron-сервисов)

Ничего из Supabase / Firebase / Auth0 / Clerk / платных email или webhook
SaaS не используется. Единственный внешний сервис — сам Railway
(хостинг + managed PostgreSQL).

## Структура

```
backend/    Express API + Prisma + вебхуки + cron
frontend/   React SPA (Vite + Tailwind)
railway.json
docker-compose.yml   # локальный Postgres для разработки
```

## Обновление после этого коммита (комментарии, ссылки, канбан)

Если вы уже разворачивали проект раньше, в схему добавлены таблицы
`comments` и `links` — выполните новую миграцию:
```bash
cd backend
npx prisma migrate dev --name add_comments_links
```
На Railway это выполнится автоматически при следующем деплое (`prisma migrate deploy` в Dockerfile).

## Локальный запуск

1. Поднимите Postgres локально (проще всего через Docker):
   ```bash
   docker compose up -d
   ```
   Это поднимет Postgres на `localhost:5432` с базой `team_tasks` (см. `docker-compose.yml`).
   Если не хотите Docker — используйте любой локальный Postgres или бесплатный
   облачный инстанс (например, встроенный Postgres от Railway) и просто
   пропишите его `DATABASE_URL`.

2. Backend:
   ```bash
   cd backend
   cp .env.example .env
   # сгенерируйте секреты:
   #   openssl rand -hex 32   -> JWT_SECRET
   #   openssl rand -hex 32   -> WEBHOOK_SECRET
   npm install
   npx prisma migrate dev --name init
   npm run seed        # создаст admin/manager/employee тестовых пользователей
   npm run dev          # http://localhost:4000
   ```
   Тестовые аккаунты после `npm run seed`:
   - `admin@example.com` / `Admin123!`
   - `manager@example.com` / `Manager123!`
   - `employee@example.com` / `Employee123!`

   **Смените эти пароли (или удалите тестовых пользователей) перед реальным использованием.**

3. Frontend (в отдельном терминале):
   ```bash
   cd frontend
   npm install
   npm run dev           # http://localhost:5173, проксирует /api на localhost:4000
   ```

## Деплой на Railway

1. Запушьте проект в GitHub-репозиторий.
2. В Railway: **New Project → Deploy from GitHub repo**, выберите репозиторий.
   Railway найдёт `railway.json` и соберёт образ по `backend/Dockerfile`
   (Dockerfile сначала собирает frontend, потом backend, и кладёт готовый
   frontend внутрь backend-контейнера — получается один сервис).
3. Добавьте плагин **PostgreSQL** в этом же Railway-проекте — Railway сам
   создаст переменную `DATABASE_URL` и подставит её в сервис.
4. В Variables сервиса добавьте:
   ```
   JWT_SECRET=<openssl rand -hex 32>
   WEBHOOK_SECRET=<openssl rand -hex 32>
   NODE_ENV=production
   ```
   (`PORT` Railway проставляет сам.)
5. Нажмите Deploy. При старте контейнера автоматически выполняется
   `prisma migrate deploy`, затем поднимается сервер.
6. Зайдите на выданный Railway URL, залогинтесь. Чтобы создать первого
   администратора — выполните разово в Railway Shell (или локально с
   продовым `DATABASE_URL`):
   ```bash
   npm run seed
   ```
   либо создайте пользователя вручную через SQL/Prisma Studio.

## Webhooks

### Исходящие (приложение → внешние системы)

Настраиваются в Admin Panel → **Webhooks**: URL, список событий, вкл/выкл,
кнопка **Test Webhook**. При создании webhook-а один раз показывается
`secret` — сохраните его, повторно он не отображается полностью.

Каждый запрос подписывается:
```
X-Webhook-Signature: HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
X-Webhook-Event: task.created
X-Webhook-Timestamp: <unix seconds>
```
Проверяйте `X-Webhook-Timestamp`, чтобы отбрасывать устаревшие (replay) запросы.

События: `task.created`, `task.updated`, `task.completed`, `task.deleted`,
`user.created`, `user.updated`, `user.deleted`, `day.started`, `day.ended`.

Неудачные доставки повторяются автоматически (максимум 3 попытки,
exponential backoff: 2с → 4с → 8с), каждая попытка пишется в
Admin Panel → **Webhook Logs**.

Очередь реализована **в памяти процесса** (без Redis) — для внутреннего
инструмента с умеренной нагрузкой этого достаточно и не требует
дополнительного платного/самостоятельно поддерживаемого сервиса. Если
позже понадобятся гарантии доставки при рестарте процесса — это
единственное место (`backend/src/services/webhookDispatcher.ts`), которое
нужно будет заменить на очередь с Redis/BullMQ.

### Входящие (внешние системы → приложение)

```
POST /api/webhooks/task-created
POST /api/webhooks/task-updated
POST /api/webhooks/task-completed
POST /api/webhooks/task-deleted
POST /api/webhooks/user-created
POST /api/webhooks/day-changed
```
Подписываются тем же способом, общим секретом `WEBHOOK_SECRET`. Сейчас
эти endpoint-ы проверяют подпись и логируют полученное событие — подключите
свою бизнес-логику в `backend/src/routes/webhooksInbound.ts` по мере
необходимости.

## Задачи: воронка, описание, комментарии, ссылки

Dashboard и Team отображают задачи как канбан-воронку с тремя колонками
(Ожидание / В работе / Готово) — карточку можно перетащить между колонками
или открыть кликом. Создание и редактирование происходит в попапе
(`frontend/src/components/TaskModal.tsx`), где доступны: название,
описание, статус, приоритет, список комментариев (с автором и временем) и
список ссылок. Компонент доски — `frontend/src/components/KanbanBoard.tsx`,
переиспользуется на обеих страницах.

## Смена дня

Никакого физического переноса задач нет. У каждой задачи есть `task_date`.
Dashboard всегда запрашивает задачи на сегодняшнюю дату, история — все
прошлые. `day.started`/`day.ended` webhook-и — это просто уведомление
(например, для дайджеста в Slack), они ничего не переносят и не удаляют.

## О стоимости

Единственная обязательная статья расходов — сам Railway (хостинг +
Postgres); всё остальное — open-source и работает в контейнере. Если вы
захотите добавить что-то платное в будущем (email, аналитика и т.д.),
сначала стоит явно решить это осознанно — в текущей архитектуре таких
зависимостей нет.
