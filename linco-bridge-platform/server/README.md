# Linco Bridge Server

NestJS demo backend with embedded bridge WebSocket gateway and SQLite storage.

## Features

- No login / JWT — single demo tenant
- No Redis — online presence in memory
- Embedded WS gateway at `/bridge/ws`
- REST APIs consumed by UniApp web client

## Scripts

```bash
npm install
npm run start:dev
npm run check
```

## Key endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/demo-config` | Demo platform config |
| GET | `/api/agent-bridges/:type/setup` | Bridge setup + commands |
| GET | `/api/agent-bridges/:type/status` | Connector online status |
| GET | `/api/sessions` | Bridge chat sessions |
| POST | `/api/sessions/:id/messages` | Send chat message |
| WS | `/bridge/ws?token=appId:appSecret` | Desktop connector |

## Demo credentials

Seeded on first boot:

- Codex: `demo-codex-app:demo-codex-secret`
- Claude: `demo-claude-app:demo-claude-secret`
- Hermes: `demo-hermes-app:demo-hermes-secret`
- OpenClaw: `demo-openclaw-app:demo-openclaw-secret`

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3300` | HTTP + WS port |
| `PUBLIC_HOST` | `127.0.0.1` | Host used in setup URLs |
| `SQLITE_PATH` | `./data/linco-bridge.db` | SQLite file path |
