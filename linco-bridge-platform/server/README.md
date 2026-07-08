# Linco Bridge Server

NestJS 自托管 Demo 后端：内嵌 Bridge WebSocket 网关，通过 `linco-connect` 将移动端请求 relay 到本机 Agent CLI（Codex / Claude Code / Hermes / OpenClaw），会话与消息持久化到 SQLite。

> 配套前端见 [`../web/README.md`](../web/README.md)，整体联调见 [`../README.md`](../README.md)。

## 特性

| 能力 | 说明 |
|------|------|
| Bridge 连接管理 | 生成 `linco-connect` 安装命令、检测在线状态、绑定上下文 / 工作区 |
| Agent 聊天 | 落地页、历史列表、开聊、SSE 流式回复、附件、取消生成 |
| Bridge 设置 | Codex / Claude 支持模型 + 推理强度（`/settings` → connector apply） |
| 内嵌 WS 网关 | `/bridge/ws` 及子路径，供 `linco-connect --channel linco-demo` 连接 |
| SQLite 持久化 | 连接、会话、消息、bridge 设置 JSON |
| Demo 单租户 | 无登录 / JWT / Redis，首次启动自动 seed 四套 demo 凭证 |

## 快速开始

```bash
npm install
npm run start:dev    # 热更新，默认 http://127.0.0.1:3300
```

健康检查：

```bash
curl http://127.0.0.1:3300/api/demo-config
```

生产构建：

```bash
npm run build
npm run start:prod
```

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run start:dev` | 开发模式（watch） |
| `npm run build` | 编译到 `dist/` |
| `npm run start:prod` | 运行编译产物 |
| `npm run test` | Jest 单元测试 |
| `npm run lint` | ESLint |
| `npm run check` | lint + format + test + build |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3300` | HTTP + WebSocket 端口（避免与常见 `:3000` 冲突） |
| `PUBLIC_HOST` | `127.0.0.1` | 写入 setup 命令中的 WS 主机名 |
| `SQLITE_PATH` | `./data/linco-bridge.db` | SQLite 文件路径 |

Docker 部署见根目录 `docker-compose.yml`。

## 架构概览

```text
UniApp H5
  ├─ REST /api/agent-bridges/*   → BridgeController → BridgeService
  ├─ REST /api/agent-chat/*      → ChatController   → ChatService
  └─ REST /api/sessions/*        → ChatController   → ChatService
                                        │
                                        ▼
                               BridgeRelayService
                                        │
                                        ▼
                          WS /bridge/ws?token=appId:appSecret
                                        │
                                        ▼
                               linco-connect（本机）
                                        │
                                        ▼
                               Codex / Claude / Hermes / OpenClaw
```

### 目录结构

```text
src/
  main.ts                 # 全局前缀 /api、CORS、BridgeWsAdapter
  app.module.ts
  bridge/
    bridge.controller.ts  # /api/agent-bridges/*
    bridge.service.ts     # setup、项目/会话列表、settings、relay 命令
    bridge.gateway.ts     # WS 连接生命周期
    bridge-relay.service.ts
    bridge-settings.util.ts
    bridge.commands*.ts   # slash 命令构造与解析
  chat/
    chat.controller.ts    # /api/sessions/*、/api/agent-chat/*
    chat.service.ts       # 会话 CRUD、流式消息、历史分组
  database/
    database.service.ts   # SQLite migrate + seed
  shared/
    api-response.ts       # { code, success, data, message }
    constants.ts          # Agent 类型、demo 用户
test/                     # Jest 规格（*.spec.ts）
```

## API 约定

所有 REST 响应统一格式：

```json
{ "code": 0, "success": true, "data": { ... }, "message": "" }
```

失败时 `success: false`，`message` 为错误描述。入参同时支持 **camelCase** 与 **snake_case**（如 `connectionId` / `connection_id`）。

### Demo / 会话

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/demo-config` | Demo 平台配置 |
| GET | `/api/sessions` | 消息 Tab 会话列表 |
| POST | `/api/sessions/:id/resume` | 恢复会话上下文 |
| GET | `/api/sessions/:id/messages` | 拉取消息（`?limit=`） |
| POST | `/api/sessions/:id/messages` | 发送消息（非流式） |
| POST | `/api/sessions/:id/messages/stream` | SSE 流式发送（支持 `files` 附件） |
| POST | `/api/sessions/:id/messages/cancel` | 取消当前流式生成 |
| POST | `/api/sessions/:id/bridge-command` | 对绑定会话执行 slash 命令 |

### Agent 落地页 / 历史

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agent-chat/:type/landing-header` | 落地页标题区 |
| GET | `/api/agent-chat/:type/history` | Agent 历史列表 |
| POST | `/api/agent-chat/:type/history/hide` | 隐藏历史项 |
| POST | `/api/agent-chat/:type/conversations` | 创建会话并发首条消息（支持 `bridgeSettings`） |
| POST | `/api/agent-chat/:type/bridge-command` | 按 Agent 类型执行 slash 命令 |

`:type` 取值：`codex` | `claude` | `hermes` | `openclaw`

### Bridge 连接 / 工作区

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agent-bridges/:type/setup` | 连接配置 + `setupCommands` |
| POST | `/api/agent-bridges/:type/setup/refresh` | 刷新 setup（需 `connectionId`） |
| GET | `/api/agent-bridges/:type/status` | Connector 在线状态 |
| GET | `/api/agent-bridges/:type/contexts` | 可绑定上下文（Hermes / OpenClaw） |
| POST | `/api/agent-bridges/:type/bind-context` | 绑定上下文 |
| GET | `/api/agent-bridges/:type/projects` | 工作区列表（Codex / Claude） |
| POST | `/api/agent-bridges/:type/select-project` | 选择工作区 |
| GET | `/api/agent-bridges/:type/sessions` | 项目下 Agent 会话（需 `projectPath`） |
| GET | `/api/agent-bridges/:type/chats` | 最近聊天列表 |
| POST | `/api/agent-bridges/:type/workspace/apply` | 应用工作区 / 会话绑定 |
| POST | `/api/agent-bridges/:type/sync` | 同步 Agent 状态 |

### Bridge 模型 / 推理设置（Codex / Claude）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agent-bridges/:type/settings/options` | 拉取模型与推理选项（connector `/settings`） |
| POST | `/api/agent-bridges/:type/settings/update` | 更新并 apply（`/settings apply --reasoning … --model …`） |

设置持久化在 `chat_sessions.bridge_settings_json`，创建会话时可随 `bridgeSettings` 一并写入。

## WebSocket

桌面端 `linco-connect` 连接地址（token 由 connector 自动追加）：

```text
ws://127.0.0.1:3300/bridge/ws?token=demo-codex-app:demo-codex-secret
```

也支持 `/bridge/ws/{agent}` 子路径（`linco-demo` 通道预设）。`BridgeWsAdapter` 会将 upgrade 请求路由到 Nest WS 网关。

## Demo 凭证

首次启动 SQLite seed 写入（每种 Agent 一条 `bridge_connections`）：

| Agent | appId | appSecret |
|-------|-------|-----------|
| codex | `demo-codex-app` | `demo-codex-secret` |
| claude | `demo-claude-app` | `demo-claude-secret` |
| hermes | `demo-hermes-app` | `demo-hermes-secret` |
| openclaw | `demo-openclaw-app` | `demo-openclaw-secret` |

## 数据表（SQLite）

| 表 | 用途 |
|----|------|
| `bridge_connections` | Bridge 凭证、绑定上下文、当前工作区 / 会话 |
| `chat_sessions` | 聊天会话（含 `bridge_project_path`、`bridge_settings_json`、`is_temp_session` 等） |
| `chat_messages` | 消息正文 + `attachments_json` |

Schema 通过 `ensureColumn` 增量迁移，升级 server 后无需手动改库。

## 流式消息（SSE）

`POST /api/sessions/:id/messages/stream` 返回 `text/event-stream`，典型事件：

| event | 说明 |
|-------|------|
| `delta` | 文本增量 |
| `reasoning_delta` | 推理过程增量 |
| `attachment` | 附件元数据 |
| `done` | 本轮结束 |
| `error` | 错误信息 |

## 测试

```bash
npm test                          # 全部
npm test -- bridge-settings       # 指定文件
npm run test:cov                  # 覆盖率
```

重点覆盖：`bridge-settings.util`、`bridge.commands.util`、会话列表分组、消息存储、relay 解析等。

## 范围说明

| 包含 | 不包含 |
|------|--------|
| Bridge setup / status / bind | 用户登录 / JWT |
| Agent 会话与流式聊天 | IM / P2P / 群聊 |
| 内嵌 `/bridge/ws` | 独立 gateway 微服务 |
| SQLite | Redis / MongoDB |
