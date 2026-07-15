# Linco Bridge Platform

[English](README.md)

Linco Bridge 自托管参考平台，用于联调本机 Agent CLI 与 H5 / 小程序前端，验证完整桥接链路。当前参考 Agent 包括 Codex、Claude Code、Hermes、OpenClaw。

## 两种体验方式

| 方式 | 说明 |
| --- | --- |
| **本地全栈 Demo** | Clone 本仓库，本地启动 `server` + `web`，适合开发者与二次开发 |
| **在线 Demo** | 使用官方部署的 H5 / 小程序 + 本机 `linco-connect`：[https://bridge-demo.lincotalk.com](https://bridge-demo.lincotalk.com)，详见 [`../docs/zh-CN/deploy-demo.md`](../docs/zh-CN/deploy-demo.md) |

在线 Demo 是不提供正式账号体系的公共体验环境。当前实现通过签名匿名访客 Session 隔离不同访客的桥接连接、会话和消息，并使用当前客户端的本地存储保留访客 Session；清理存储、更换设备或使用无痕模式后，之前的 Demo 状态可能无法继续访问。这不等同于生产级多租户安全或账号恢复机制，请勿提交敏感信息或正式业务数据。

**第三方前端：** fork 或修改 `web` 后请自托管 Server；**不得**将 API 指向官方 `bridge-demo.lincotalk.com`（官方 Server 仅放行官方 H5 / 小程序域名，见 `CORS_ORIGINS`）。

## 目录结构

```text
linco-bridge-platform/
  server/              # NestJS 后端（SQLite + 内嵌 bridge WS）
  web/                 # UniApp 前端（H5 + 小程序）
  docker-compose.yml
```

## 使用说明

- 联调入口就是 `linco-bridge-platform/server` 和 `linco-bridge-platform/web`
- 完整联调时必须先启动后端，再启动前端
- 命令名保持为 `linco-connect`，不要改写
- 开源参考通道为 `linco-demo`

## 快速开始

### 1. 启动后端

```bash
cd linco-bridge-platform/server
npm install
npm run start:dev
```

默认地址：

```text
http://127.0.0.1:3300
```

健康检查：

```bash
curl http://127.0.0.1:3300/api/demo-config
```

### 2. 启动前端

```bash
cd linco-bridge-platform/web
npm install
npm run dev:h5
```

H5 开发模式下会把 `/api` 代理到后端。

### 3. 可选：重新生成图标

如果仓库里已经提交了图标资源，首次体验无需执行此步骤。

```bash
cd linco-bridge-platform/web
node scripts/generate-icons.mjs
```

### 4. 连接本机 Agent

如需安装本地连接器，可在兄弟项目中执行：

```bash
cd linco-bridge-connect
npm install -g .
```

打开 `npm run dev:h5` 输出的 H5 地址，进入 **桥接** 页，再打开 **从 Codex 导入**。复制页面生成的命令并在本机终端执行。典型命令如下：

```bash
npm install -g linco-connect
linco-connect init --token "demo-codex-app:demo-codex-secret" --agent codex --channel linco-demo --account codex_1 --allow-insecure-ws
linco-connect start --daemon
linco-connect doctor
```

随后回到 H5 页面：

1. 点击 `我已复制，获取连接状态`
2. 等待页面确认连接成功
3. 点击 `进入 Codex`
4. 如需选择项目、进入已有会话或用 `+` 新建会话，可点击右上角文件夹图标

## Demo 凭证

| Agent | appId | appSecret |
| --- | --- | --- |
| codex | `demo-codex-app` | `demo-codex-secret` |
| claude | `demo-claude-app` | `demo-claude-secret` |
| hermes | `demo-hermes-app` | `demo-hermes-secret` |
| openclaw | `demo-openclaw-app` | `demo-openclaw-secret` |

## WebSocket 地址

连接器会自动追加 `token` 参数：

```text
ws://127.0.0.1:3300/bridge/ws?token=demo-codex-app:demo-codex-secret
```

## SDK 路由

| 模块 | 默认模式 | Mock 开关 |
| --- | --- | --- |
| `BridgeSdk` | REST | `VITE_USE_REMOTE_API=false` |
| `AgentChatSdk` | REST | `VITE_AGENT_CHAT_SDK=mock` |

数据流：

```text
H5 → BridgeSdk REST → /api/agent-bridges/*
H5 → AgentChatSdk REST → /api/agent-chat/*
H5 → Session API → /api/sessions/* → BridgeRelay → WS → linco-connect → 本机 Agent
```

## 工程检查

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

## 范围

| 包含 | 不包含 |
| --- | --- |
| Bridge setup、status、bind | 登录与 JWT |
| Agent 聊天会话 | IM、P2P、群聊 |
| 内嵌 `/bridge/ws` 网关 | 独立 gateway 服务 |
| SQLite 持久化 | Redis |

## Agent 规则

- Codex 和 Claude 支持工作区选择，以及模型、推理强度设置
- Hermes 和 OpenClaw 在导入时一条 demo 凭证仅绑定一个 Profile 或 Agent，不支持聊天中切换
- 如果桥接能力发生变化，请同步更新 [`web/README.zh-CN.md`](web/README.zh-CN.md) 与 [`server/README.zh-CN.md`](server/README.zh-CN.md)
