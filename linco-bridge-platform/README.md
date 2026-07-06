# Linco Bridge Platform

Self-hosted demo platform for bridging mobile clients to local Agent CLIs (Codex, Claude Code, Hermes, OpenClaw).

## Layout

```text
linco-bridge-platform/
  web/                 # UniApp frontend (H5 + mini program)
  server/              # NestJS backend (SQLite + embedded bridge WS)
  docker-compose.yml
```

## Quick start

### 1. Start backend

```bash
cd server
npm install
npm run start:dev
```

Server listens on `http://127.0.0.1:3300` (default port avoids conflict with other local services on `:3000`).

### 2. Start frontend

```bash
cd web
npm install
node scripts/generate-icons.mjs
npm run dev:h5
```

H5 dev server proxies `/api` to the backend.

### 3. Connect desktop agent

Use credentials from `GET /api/agent-bridges/codex/setup`, then run the returned `setupCommands` on your PC with `linco-connect` (or compatible connector).

WebSocket endpoint:

```text
ws://127.0.0.1:3300/bridge/ws?token=demo-codex-app:demo-codex-secret
```

## Docker

```bash
docker compose up --build
```

## Engineering checks

```bash
cd web && npm run check
cd server && npm run check
```

## Scope

| Included | Excluded |
|----------|----------|
| Bridge setup / status / bind | Login / JWT |
| Agent chat sessions | IM / P2P / groups |
| Embedded `/bridge/ws` gateway | Separate gateway service |
| SQLite persistence | Redis |

## Phase status

- Phase 1 — UniApp UI + bridge SDK placeholder ✅
- Phase 2 — Demo backend + API integration ✅
