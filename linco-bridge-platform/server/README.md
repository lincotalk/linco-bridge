# Linco Bridge Server

[简体中文](README.zh-CN.md)

NestJS backend for the self-hosted reference platform. It exposes REST APIs, embeds the bridge WebSocket gateway, relays requests to the local Agent through `linco-connect`, and persists sessions and messages in SQLite.

> See [`../README.md`](../README.md) for the full platform flow and [`../web/README.md`](../web/README.md) for the paired frontend.

## Features

| Capability | Description |
| --- | --- |
| Bridge connection management | Generates setup commands, checks connector status, and binds context or workspace |
| Agent chat | Landing page, history, create conversation, SSE streaming, attachments, and cancel generation |
| Bridge settings | Codex and Claude support model and reasoning settings |
| Embedded WS gateway | `/bridge/ws` and subpaths for the `linco-demo` channel |
| SQLite persistence | Stores bridge connections, sessions, messages, and bridge settings |
| Demo single-tenant mode | Seeds four demo credential sets on first startup |

## Quick Start

```bash
cd linco-bridge-platform/server
npm install
npm run start:dev
```

Default address:

```text
http://127.0.0.1:3300
```

Health check:

```bash
curl http://127.0.0.1:3300/api/demo-config
```

Production build:

```bash
npm run build
npm run start:prod
```

## Common Scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Development mode with watch |
| `npm run build` | Build to `dist/` |
| `npm run start:prod` | Run compiled output |
| `npm run test` | Jest unit tests |
| `npm run lint` | ESLint |
| `npm run check` | lint + format + test + build |

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3300` | HTTP and WebSocket port |
| `PUBLIC_HOST` | `127.0.0.1` | Hostname written into generated setup commands |
| `SQLITE_PATH` | `./data/linco-bridge.db` | SQLite file path |

## API Shape

All REST responses use:

```json
{ "code": 0, "success": true, "data": {}, "message": "" }
```

Failed requests return `success: false`. Request payloads support both `camelCase` and `snake_case`.

## Main Endpoints

### Demo and sessions

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/demo-config` | Demo platform config |
| GET | `/api/sessions` | Session list for the message tab |
| POST | `/api/sessions/:id/resume` | Resume session context |
| GET | `/api/sessions/:id/messages` | Message list |
| POST | `/api/sessions/:id/messages` | Send a non-streaming message |
| POST | `/api/sessions/:id/messages/stream` | Send an SSE streaming message |
| POST | `/api/sessions/:id/messages/cancel` | Cancel streaming generation |
| POST | `/api/sessions/:id/bridge-command` | Run a slash command for the bound session |

### Agent landing and history

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/agent-chat/:type/landing-header` | Landing-page header |
| GET | `/api/agent-chat/:type/history` | Agent history list |
| POST | `/api/agent-chat/:type/history/hide` | Hide a history item |
| POST | `/api/agent-chat/:type/conversations` | Create a conversation and optionally send the first message |
| POST | `/api/agent-chat/:type/bridge-command` | Run a slash command by agent type |

### Bridge connection and workspace

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/agent-bridges/:type/setup` | Setup config plus `setupCommands` |
| POST | `/api/agent-bridges/:type/setup/refresh` | Refresh setup |
| GET | `/api/agent-bridges/:type/status` | Connector online status |
| GET | `/api/agent-bridges/:type/contexts` | Import-time context list for Hermes and OpenClaw |
| POST | `/api/agent-bridges/:type/bind-context` | First-time context binding |
| GET | `/api/agent-bridges/:type/projects` | Workspace list for Codex and Claude |
| POST | `/api/agent-bridges/:type/select-project` | Select workspace |
| GET | `/api/agent-bridges/:type/sessions` | Agent sessions under a workspace |
| GET | `/api/agent-bridges/:type/chats` | Recent chat list |
| POST | `/api/agent-bridges/:type/workspace/apply` | Apply workspace or session binding |
| POST | `/api/agent-bridges/:type/sync` | Sync Agent state |

### Bridge settings for Codex and Claude

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/agent-bridges/:type/settings/options` | Fetch model and reasoning options |
| POST | `/api/agent-bridges/:type/settings/update` | Update and apply settings |

## Architecture

```text
UniApp H5
  ├─ REST /api/agent-bridges/*
  ├─ REST /api/agent-chat/*
  └─ REST /api/sessions/*
                │
                ▼
        BridgeRelayService
                │
                ▼
      WS /bridge/ws?token=appId:appSecret
                │
                ▼
         linco-connect on the local machine
                │
                ▼
     Codex / Claude / Hermes / OpenClaw
```

## WebSocket

Example local endpoint:

```text
ws://127.0.0.1:3300/bridge/ws?token=demo-codex-app:demo-codex-secret
```

The `linco-demo` channel preset can also use `/bridge/ws/{agent}` subpaths.

## Demo Credentials

| Agent | appId | appSecret |
| --- | --- | --- |
| codex | `demo-codex-app` | `demo-codex-secret` |
| claude | `demo-claude-app` | `demo-claude-secret` |
| hermes | `demo-hermes-app` | `demo-hermes-secret` |
| openclaw | `demo-openclaw-app` | `demo-openclaw-secret` |

## Streaming Events

`POST /api/sessions/:id/messages/stream` returns `text/event-stream` with events such as:

| Event | Description |
| --- | --- |
| `delta` | Text increment |
| `reasoning_delta` | Reasoning increment |
| `attachment` | Attachment metadata |
| `done` | End of one response |
| `error` | Error message |

## Tests

```bash
npm test
npm run test:cov
```

## Scope

| Included | Excluded |
| --- | --- |
| Bridge setup, status, and binding | Login and JWT |
| Agent sessions and streaming chat | IM, P2P, and group chat |
| Embedded `/bridge/ws` | Separate gateway microservice |
| SQLite | Redis and MongoDB |
