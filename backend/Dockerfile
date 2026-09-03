# --- Build frontend ---
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build


# --- Build backend ---
FROM node:20-slim AS backend-build
WORKDIR /app/backend

COPY backend/package*.json ./
COPY backend/prisma ./prisma

RUN apt-get update -y \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install

COPY backend/ ./

RUN npx prisma generate
RUN npm run build


# --- Runtime ---
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update -y \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=backend-build /app/backend/package*.json ./backend/
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/prisma ./backend/prisma

COPY --from=frontend-build /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]