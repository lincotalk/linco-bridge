# Linco Connect 架构说明

本文面向需要阅读、调试或扩展 `linco-bridge-connect` 的贡献者。

## 运行角色

Linco Connect 是运行在用户本机的 Agent 连接器。它负责把远端 IM 消息转换成本地 Agent CLI 或 Agent Gateway 的输入，并把 Agent 的回复、流式输出、工具调用、权限确认和文件引用转换回远端 IM 可消费的事件。

它不是鉴权中心，也不是托管式多租户服务。用户凭证保存在本机配置中，远端连接通过配置中的 channel/account/agent 组合建立。

## 主要目录

| 目录 | 职责 |
| --- | --- |
| `bin/` | npm CLI 入口，当前暴露 `linco-connect` 命令。 |
| `src/cli/` | CLI 入口和本机操作。`index.js` 保持为命令分发入口，初始化、账号、ws-prefix、后台进程、doctor 和帮助输出按职责拆到独立模块。 |
| `src/service/` | 本地服务启动、关闭和生命周期编排；包含后台控制通道和运行时配置热加载。 |
| `src/local/` | 本地测试页、本地访问鉴权和本地 WebSocket 接入；WebSocket 连接生命周期、消息分发、Linco 本地协议、presence 和 turn 控制按模块拆分。 |
| `src/update/` | npm 包自更新检查、状态记录和后台更新调度。 |
| `src/config/` | 默认配置、环境变量、用户配置读写、命令路径解析和账号配置处理。 |
| `src/channels/` | 远端 channel 注册、连接器和 Linco 协议适配。 |
| `src/agents/` | Claude、Codex、Hermes、OpenClaw 的 Agent 适配器。 |
| `src/runtime/` | Agent 运行环境、进程 runner、Claude 历史和项目路径辅助逻辑。 |
| `src/commands/` | 远端会话内的本地斜杠命令处理。`index.js` 保持为分发入口，具体命令逻辑按职责拆到独立模块。 |
| `src/core/` | session、协议发送、日志、权限状态、文件引用、流式缓冲等共享核心逻辑。 |
| `src/attachments/` | 入站附件落盘、类型检查和图片处理。 |
| `src/gateways/` | Hermes/OpenClaw Gateway 启动、健康检查和客户端封装。 |
| `packages/protocol/` | 可复用的消息、文件、channel 规范化工具。 |
| `packages/connector-sdk/` | 远端桥接 WebSocket 客户端、认证 URL、重连、心跳和消息队列。 |
| `public/` | 本地测试页。 |
| `test/` | Node.js 原生 test runner 测试。 |

## 数据流

1. 远端 IM 通过 WebSocket 发送 `inbound_message`。
2. `src/channels/bridge/connector.js` 根据 channel/account/agent/sessionKey 找到或创建本地 session。
3. `src/channels/bridge/protocolAdapter.js` 把 Linco 消息转换为内部消息格式，并保留 `_lincoMeta` 作为桥接层路由元数据。
4. `src/runtime/agentRunner.js` 按 `session.agentType` 调用对应 Agent 适配器。
5. Agent 适配器启动本地 CLI 或调用 Gateway，并把输出转换为内部事件，例如 `assistant_chunk`、`tool_call`、`permission_request`、`turn_end`。
6. 协议适配器把内部事件转换为 Linco 事件，例如 `stream_chunk`、`outbound_message`、`slash_command_result`、`turn_end`。
7. 远端 IM 依据 `streamId`、`sessionKey`、`messageId` 等字段更新 UI 状态。

## 模块边界

`src/core` 不应该依赖具体 Agent。它提供 session、日志、权限、文件和通用协议能力。

`src/agents` 可以依赖 `src/core` 和 `src/runtime`，但不应该直接处理远端 IM 的 channel/account 连接细节。

`src/channels` 负责远端连接和协议适配，不应该包含具体 Agent CLI 的启动细节。

`src/local` 只处理本机测试页和本地 WebSocket 接入。`websocket.js` 保持为连接入口，session 建立、消息分发、Linco 本地消息、presence 事件和 stop turn 控制分别放在独立模块中。

`packages/protocol` 和 `packages/connector-sdk` 应尽量保持轻量、可复用，避免反向依赖 `src/`。

## 会话标识

Linco Connect 内部至少会同时处理三类标识：

| 标识 | 来源 | 用途 |
| --- | --- | --- |
| `sessionKey` | 远端 IM 或连接器生成 | 桥接层会话路由。 |
| `agentSessionId` | Agent CLI/Gateway 返回 | 恢复 Claude/Codex/Hermes/OpenClaw 的原生会话。 |
| `messageId` / `streamId` | 远端 IM 或连接器生成 | 绑定一次用户消息、流式回复和 `turn_end`。 |

新增功能时应保留这些标识，不要把 `_lincoMeta` 拼入用户正文或 Agent prompt。
