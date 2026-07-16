# Linco Bridge Server

[English](README.md)

Linco Bridge 参考平台的 NestJS 后端。它提供 REST API，内嵌 bridge WebSocket 网关，通过 `linco-connect` 把请求 relay 到本机 Agent，并使用 SQLite 持久化会话与消息。

> 完整平台流程见 [`../README.zh-CN.md`](../README.zh-CN.md)，配套前端见 [`../web/README.zh-CN.md`](../web/README.zh-CN.md)。

## 核心能力

| 能力 | 说明 |
| --- | --- |
| Bridge 连接管理 | 生成连接命令、检测连接器状态、绑定上下文或工作区 |
| Agent 聊天 | 落地页、历史、创建会话、SSE 流式回复、附件、取消生成 |
| Bridge 设置 | Codex 和 Claude 支持模型与推理强度设置 |
| 内嵌 WS 网关 | 为 `linco-demo` 通道提供 `/bridge/ws` 及子路径 |
| SQLite 持久化 | 存储 bridge 连接、会话、消息和 bridge 设置 |
| 匿名访客 Demo 模式 | 使用签名访客 Session 隔离 Demo 数据，并在访客首次访问时生成四组凭证 |

## 快速开始

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

生产构建：

```bash
npm run build
npm run start:prod
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run start:dev` | 开发模式，自动监听 |
| `npm run build` | 编译到 `dist/` |
| `npm run start:prod` | 运行编译产物 |
| `npm run test` | Jest 单元测试 |
| `npm run lint` | ESLint |
| `npm run check` | lint + format + test + build |

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3300` | HTTP 与 WebSocket 端口 |
| `PUBLIC_HOST` | `127.0.0.1` | 写入 demo-config 与 setup 命令的主机名 |
| `PUBLIC_HTTP_SCHEME` | 本地 `http`，否则 `https` | REST 根地址 scheme |
| `PUBLIC_WS_SCHEME` | 本地 `ws`，否则 `wss` | connector WebSocket scheme |
| `SQLITE_PATH` | `./data/linco-bridge.db` | SQLite 文件路径 |
| `CORS_ORIGINS` | 开发环境允许全部；生产环境禁止跨域 | 允许调用 API 的浏览器 Origin，多个值用逗号分隔；只有确实需要全部放行时才使用 `*` |
| `VISITOR_SESSION_SECRET` | 开发环境有回退值；生产环境必填 | 用于签名匿名访客 Session token 的 HMAC 密钥 |

公网部署时，请配置可以调用 API 的准确前端域名，并使用足够长的随机访客 Session 密钥：

```env
CORS_ORIGINS=https://bridge-demo.lincotalk.com
VISITOR_SESSION_SECRET=<random-secret>
```

多个 CORS Origin 可用逗号分隔。`CORS_ORIGINS` 只约束浏览器 REST 请求，不是 connector 的 WebSocket token。可使用 `openssl rand -hex 32` 等安全随机方式生成密钥，不要将它提交到仓库或对外分享。更换密钥后，之前签发的访客 Session 将失效。

在线 Demo 部署见 [`../../docs/zh-CN/deploy-demo.md`](../../docs/zh-CN/deploy-demo.md)。当 `PUBLIC_HOST` 为公网域名时，导入页 `setupCommands` 会自动包含 `--ws-url wss://...`。

## API 返回格式

所有 REST 接口统一返回：

```json
{ "code": 0, "success": true, "data": {}, "message": "" }
```

失败时返回 `success: false`。请求参数同时兼容 `camelCase` 与 `snake_case`。

## 主要接口

### 访客 Session

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/visitor/bootstrap` | 创建或复用签名匿名访客 Session，写入 Session Cookie，并返回会话信息 |

响应示例：

```json
{
  "code": 0,
  "success": true,
  "data": {
    "visitorId": "6e2f8d8c-...",
    "reused": false,
    "sessionToken": "<signed-session-token>"
  },
  "message": ""
}
```

除公开的 bootstrap 和配置接口外，REST 请求需要携带 `linco-bridge-session` HttpOnly Cookie，或在 `X-Linco-Visitor-Session` Header 中携带返回的 token。Cookie 使用 `SameSite=Lax`，并会在生产环境自动标记为 `Secure`。Token 有效期为 365 天；已有有效 Session 再次 bootstrap 时会获得新 token。参考 H5 和小程序客户端会自动处理。该 Session 用于按匿名访客隔离 Bridge 连接、会话和消息；它不是正式账号，也不提供持久的跨设备恢复能力。

### Demo 与会话

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/demo-config` | Demo 平台配置 |
| GET | `/api/sessions` | 消息页会话列表 |
| POST | `/api/sessions/:id/resume` | 恢复会话上下文 |
| GET | `/api/sessions/:id/messages` | 拉取消息列表 |
| POST | `/api/sessions/:id/messages` | 发送非流式消息 |
| POST | `/api/sessions/:id/messages/stream` | 发送 SSE 流式消息 |
| POST | `/api/sessions/:id/messages/cancel` | 取消当前生成 |
| POST | `/api/sessions/:id/bridge-command` | 对绑定会话执行 slash 命令 |

### Agent 落地页与历史

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/agent-chat/:type/landing-header` | 落地页标题区 |
| GET | `/api/agent-chat/:type/history` | Agent 历史列表 |
| POST | `/api/agent-chat/:type/history/hide` | 隐藏历史项 |
| POST | `/api/agent-chat/:type/conversations` | 创建会话并可带首条消息 |
| POST | `/api/agent-chat/:type/bridge-command` | 按 Agent 类型执行 slash 命令 |

### Bridge 连接与工作区

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/agent-bridges/:type/setup` | 连接配置与 `setupCommands` |
| POST | `/api/agent-bridges/:type/setup/refresh` | 刷新 setup |
| GET | `/api/agent-bridges/:type/status` | 连接器在线状态 |
| GET | `/api/agent-bridges/:type/contexts` | Hermes / OpenClaw 导入时可绑定的上下文列表 |
| POST | `/api/agent-bridges/:type/bind-context` | 首次绑定上下文 |
| GET | `/api/agent-bridges/:type/projects` | Codex / Claude 工作区列表 |
| POST | `/api/agent-bridges/:type/select-project` | 选择工作区 |
| GET | `/api/agent-bridges/:type/sessions` | 工作区下的 Agent 会话 |
| GET | `/api/agent-bridges/:type/chats` | 最近聊天列表 |
| POST | `/api/agent-bridges/:type/workspace/apply` | 应用工作区或会话绑定 |
| POST | `/api/agent-bridges/:type/sync` | 同步 Agent 状态 |

### Codex / Claude 设置接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/agent-bridges/:type/settings/options` | 获取模型与推理强度选项 |
| POST | `/api/agent-bridges/:type/settings/update` | 更新并 apply 设置 |

## 架构

```text
UniApp H5 / 微信小程序
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
         linco-connect（本机）
                │
                ▼
     Codex / Claude / Hermes / OpenClaw
```

## WebSocket

本地示例地址：

```text
ws://127.0.0.1:3300/bridge/ws?token=demo-codex-app:demo-codex-secret
```

`linco-demo` 通道也支持 `/bridge/ws/{agent}` 子路径。

## Demo 连接凭证

匿名访客首次访问时，后端会分别创建 Codex、Claude、Hermes 和 OpenClaw 连接记录。`GET /api/agent-bridges/:type/setup` 会将初始 seed secret 更换为随机的访客专属 secret，并返回当前 `appId`、`appSecret`、`accountId`、WebSocket URL 和 `setupCommands`。

请始终复制并执行 Bridge 页面实际生成的 `setupCommands`，不要硬编码 Demo 凭证，也不要复用其他访客的连接信息。

## 流式事件

`POST /api/sessions/:id/messages/stream` 返回 `text/event-stream`，典型事件如下：

| 事件 | 说明 |
| --- | --- |
| `delta` | 文本增量 |
| `reasoning_delta` | 推理增量 |
| `attachment` | 附件元数据 |
| `done` | 本轮结束 |
| `error` | 错误信息 |

## 测试

```bash
npm test
npm run test:cov
```

## 范围

| 包含 | 不包含 |
| --- | --- |
| Bridge setup、status、bind | 登录与 JWT |
| Agent 会话与流式聊天 | IM、P2P、群聊 |
| 内嵌 `/bridge/ws` | 独立 gateway 微服务 |
| SQLite | Redis、MongoDB |
