# Linco Bridge Platform

[简体中文](README.zh-CN.md)

Self-hosted reference platform for validating the Linco Bridge flow with local Agent CLIs such as Codex, Claude Code, Hermes, and OpenClaw.

## Structure

```text
linco-bridge-platform/
  server/              # NestJS backend (SQLite + embedded bridge WS)
  web/                 # UniApp frontend (H5 + mini program)
  docker-compose.yml
```

## Read This First

- Start from `linco-bridge-platform/server` and `linco-bridge-platform/web`.
- Run the backend before the web frontend for end-to-end testing.
- Keep command names such as `linco-connect init` and `linco-connect start --daemon` unchanged.
- The open-source reference channel is `linco-demo`.

## Quick Start

### 1. Start the backend

```bash
cd linco-bridge-platform/server
npm install
npm run start:dev
```

Default address:

```text
http://127.0.0.1:3300
```

Verify the backend:

```bash
curl http://127.0.0.1:3300/api/demo-config
```

### 2. Start the web frontend

```bash
cd linco-bridge-platform/web
npm install
npm run dev:h5
```

The H5 development server proxies `/api` to the backend.

### 3. Optional: regenerate icons

You do not need this step for normal open-source evaluation if the committed icon assets are already present.

```bash
cd linco-bridge-platform/web
node scripts/generate-icons.mjs
```

### 4. Connect the local Agent

Install the local connector from the sibling project if needed:

```bash
cd linco-bridge-connect
npm install -g .
```

Open the H5 URL shown by `npm run dev:h5`, go to the **Bridge** tab, then open **Import from Codex**. Copy the generated setup commands and run them in a local terminal. A typical command set looks like this:

```bash
npm install -g linco-connect
linco-connect init --token "demo-codex-app:demo-codex-secret" --agent codex --channel linco-demo --account codex_1 --allow-insecure-ws
linco-connect start --daemon
linco-connect doctor
```

Then return to the H5 page:

1. Click `I have copied it, get connection status`.
2. Wait until the page confirms the connector is online.
3. Click `Enter Codex`.
4. Open the folder icon in the top-right corner if you want to choose a project, enter an existing session, or create a new session with `+`.

## Demo Credentials

| Agent | appId | appSecret |
| --- | --- | --- |
| codex | `demo-codex-app` | `demo-codex-secret` |
| claude | `demo-claude-app` | `demo-claude-secret` |
| hermes | `demo-hermes-app` | `demo-hermes-secret` |
| openclaw | `demo-openclaw-app` | `demo-openclaw-secret` |

## WebSocket Endpoint

The connector automatically appends the `token` query parameter:

```text
ws://127.0.0.1:3300/bridge/ws?token=demo-codex-app:demo-codex-secret
```

## SDK Routing

| Module | Default mode | Mock switch |
| --- | --- | --- |
| `BridgeSdk` | REST | `VITE_USE_REMOTE_API=false` |
| `AgentChatSdk` | REST | `VITE_AGENT_CHAT_SDK=mock` |

Data flow:

```text
H5 → BridgeSdk REST → /api/agent-bridges/*
H5 → AgentChatSdk REST → /api/agent-chat/*
H5 → Session API → /api/sessions/* → BridgeRelay → WS → linco-connect → local Agent
```

## Engineering Checks

```bash
cd linco-bridge-platform/server
npm run check

cd ../web
npm run check
```

## Docker

```bash
docker compose up --build
```

## Scope

| Included | Excluded |
| --- | --- |
| Bridge setup, status, and binding | Login and JWT |
| Agent chat sessions | IM, P2P, and group chat |
| Embedded `/bridge/ws` gateway | Separate gateway service |
| SQLite persistence | Redis |

## Agent Rules

- Codex and Claude support workspace selection plus model and reasoning settings.
- Hermes and OpenClaw bind one demo credential to one Profile or Agent during import, and do not support in-chat switching.
- If bridge capabilities change, update both [`web/README.md`](web/README.md) and [`server/README.md`](server/README.md) together.
