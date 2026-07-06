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

### 3. Connect desktop agent (`linco-bridge-connect`)

1. Install connector from sibling repo:

```bash
cd ../linco-bridge-connect
npm install -g .
```

2. Start H5 + server, open **桥接 → 从 Codex 导入**，复制页面上的 `setupCommands`（使用 `linco-connect` 的 **`linco-demo`** 通道，WS 地址由插件预设，无需 `--ws-url`）。

3. 在本机 PowerShell 执行复制出来的命令，例如：

```bash
linco-connect init --token "demo-codex-app:demo-codex-secret" --agent codex --channel linco-demo --account codex_1 --allow-insecure-ws
linco-connect start --daemon
linco-connect doctor
```

4. 回到 H5 点击「检测连接」→「继续」，进入 Agent 落地页。发送消息会经 server relay 转发到本机 Agent。

WebSocket endpoint（`linco-connect` 会自动追加 `token` 参数）：

```text
ws://127.0.0.1:3300/bridge/ws?token=demo-codex-app:demo-codex-secret
```

Demo 凭证（SQLite seed）：

| Agent | appId | appSecret |
|-------|-------|-----------|
| codex | demo-codex-app | demo-codex-secret |
| claude | demo-claude-app | demo-claude-secret |
| hermes | demo-hermes-app | demo-hermes-secret |
| openclaw | demo-openclaw-app | demo-openclaw-secret |

## SDK 切换

| 模块 | 默认 | Mock 开关 |
|------|------|-----------|
| BridgeSdk（连接/状态/绑定） | REST | `VITE_USE_REMOTE_API=false` |
| AgentChatSdk（落地页/历史/开聊） | REST（随 Bridge 同 gate） | `VITE_AGENT_CHAT_SDK=mock` |

数据流：

```text
H5 → BridgeSdk REST → /api/agent-bridges/*
H5 → AgentChatSdk REST → /api/agent-chat/*
H5 → Session API → /api/sessions/* → BridgeRelay → WS → linco-connect → 本地 Agent
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
- Phase 3 — `linco-bridge-connect` 插件联调（WS relay + AgentChat REST）✅
