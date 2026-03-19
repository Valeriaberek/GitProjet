# Rowing Logbook Monorepo

Monorepo containing:

- `backend/` - NestJS API
- `web/` - React + Vite admin app
- `app/` - React Native Expo mobile app

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker + Docker Compose (for local db + Mailpit)

## Install

```bash
pnpm install
```

## Run apps

```bash
pnpm dev:backend
pnpm dev:web
pnpm dev:app
```

## Local infra

```bash
docker compose -f docker-compose.dev.yml up -d
```

Mailpit UI: http://localhost:8025
