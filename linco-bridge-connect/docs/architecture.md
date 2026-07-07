# Linco Connect 架构说明

本文面向需要阅读、调试或扩展 `linco-bridge-connect` 的贡献者。

## 运行角色

Linco Connect 是运行在用户本机的 Agent 连接器。它负责把远端 IM 消息转换成本地 Agent CLI 或 Agent Gateway 的输入，并把 Agent 的回复、流式输出、工具调用、权限确认和文件引用转换回远端 IM 可消费的事件。

它不是鉴权中心，也不是托管式多租户服务。用户凭证保存在本机配置中，远端连接通过配置中的 channel/account/agent 组合建立。

从开源定位看，Linco Connect 不只服务官方 Linco IM。很多桥接项目会依赖飞书、微信、钉钉等既有平台，但这些平台的消息展示和交互形态不一定适合 Agent 的工具进度、权限确认、生成文件和长会话。配套开源的 platform 项目对应 `lincoDemo` 通道，用作可部署、可体验、可参考的实现。第三方可以基于自己的 H5、小程序、App 或其他前端形态新增 channel adapter，保留公共连接器和 Agent 适配层，同时独立演进自己的协议和交互体验。

## 主要目录

| 目录 | 职责 |
| --- | --- |
| `bin/` | npm CLI 入口，当前暴露 `linco-connect` 命令。 |
| `src/cli/` | CLI 入口和本机操作。`index.js` 保持为命令分发入口，初始化、账号、ws-prefix、后台进程、doctor 和帮助输出按职责拆到独立模块。 |
| `src/service/` | 本地服务启动、关闭和生命周期编排；包含后台控制通道和运行时配置热加载。 |
| `src/local/` | 本地测试页、本地访问鉴权和本地 WebSocket 接入；WebSocket 连接生命周期、消息分发、Linco 本地协议、presence 和 turn 控制按模块拆分。 |
| `src/update/` | npm 包自更新检查、状态记录和后台更新调度。 |
| `src/config/` | 默认配置、环境变量、用户配置读写、命令路径解析和账号配置处理。 |
| `src/channel/` | 具体 channel adapter 实现。当前包含 `linco/` 和 `lincoDemo/`；公共连接、注册和 presence 逻辑放在 `src/core/`。 |
| `src/agent/` | Claude、Codex、Hermes、OpenClaw 的 Agent 适配器；按 Agent 类型放入同名目录，并以各目录的 `index.js` 作为 provider 入口。 |
| `src/runtime/` | Agent 运行环境、进程 runner、Claude 历史和项目路径辅助逻辑。 |
| `src/command/` | 远端会话内的本地斜杠命令处理。`index.js` 保持为分发入口，具体命令逻辑按职责拆到独立模块。 |
| `src/core/` | session、协议发送、日志、权限状态、文件引用、流式缓冲等共享核心逻辑。 |
| `src/attachment/` | 入站附件落盘、类型检查和图片处理。 |
| `src/gateway/` | Hermes/OpenClaw Gateway 启动、健康检查和客户端封装。 |
| `src/package/protocol/` | 可复用的消息、文件、channel 规范化工具。 |
| `src/package/connector/` | 远端桥接 WebSocket 客户端、认证 URL、重连、心跳和消息队列。 |
| `public/` | 本地测试页。 |
| `test/` | Node.js 原生 test runner 测试。 |

## 数据流

1. 远端 channel 通过 WebSocket 发送自己的外部协议消息，例如 Linco 的 `inbound_message`。
2. `src/core/channelConnector.js` 根据配置中的 `channel` 取得 adapter，并根据 channel/account/agent/sessionKey 找到或创建本地 session。
3. channel adapter 把外部消息转换为公共连接器可消费的内部输入，并保留必要的路由元数据；当前 `linco` 和 `linco-demo` 是两个独立 adapter，`linco-demo` 目前复用 Linco 兼容协议实现。
4. `src/runtime/agentRunner.js` 按 `session.agentType` 调用对应 Agent 适配器。
5. Agent 适配器启动本地 CLI 或调用 Gateway，并把输出转换为内部事件，例如 `assistant_chunk`、`tool_call`、`permission_request`、`turn_end`。
6. channel adapter 把内部事件转换为对应 channel 的外部事件，例如 Linco 的 `stream_chunk`、`outbound_message`、`slash_command_result`、`turn_end`。
7. 远端 channel 依据 `streamId`、`sessionKey`、`messageId` 等字段更新 UI 状态。

## 模块边界

`src/core` 不应该依赖具体 Agent。它提供 session、日志、权限、文件和通用协议能力。

`src/agent` 可以依赖 `src/core` 和 `src/runtime`，但不应该直接处理远端 IM 的 channel/account 连接细节。新增 Agent 时优先使用 `src/agent/<agent>/index.js` 作为 provider 入口，并在目录内继续按进程启动、事件解析、权限处理、模型/设置等职责拆分。Codex 适配器已将输入构造放在 `src/agent/codex/input.js`，模型和推理选项放在 `src/agent/codex/options.js`；Claude 将输入 payload 和模型/effort 选项拆到 `input.js`、`options.js`；Hermes 将 profile/model 解析拆到 `options.js`；OpenClaw 将 agent/session 标识处理拆到 `identity.js`。

`src/channel` 只放具体 channel adapter，不应该包含公共连接器、注册表或具体 Agent CLI 的启动细节。公共连接流程放在 `src/core/channelConnector.js`，channel 注册放在 `src/core/channelRegistry.js`，presence 构造放在 `src/core/channelPresence.js`；官方 Linco IM 协议放在 `src/channel/linco/`，开源 H5 示例协议放在 `src/channel/lincoDemo/`。新增第三方 channel 时优先新增 `src/channel/<channel>/`，并通过 `registerChannelAdapter()` 注册，不应修改官方 `linco` channel。

`src/local` 只处理本机测试页和本地 WebSocket 接入。`websocket.js` 保持为连接入口，session 建立、消息分发、Linco 本地消息、presence 事件和 stop turn 控制分别放在独立模块中。

`src/package/protocol` 和 `src/package/connector` 应尽量保持轻量、可复用，避免反向依赖 `src/` 中的业务模块。

## Agent Prompt

`src/core/agentPrompt.js` 统一维护 Agent 可见的 Linco Connect 桥接身份说明和通用交付规则。提示词应说明 Agent 正在通过 Linco Connect 连接 Linco IM，普通文本回复会自动发送给用户，不需要额外调用发送机制。

Claude 通过 `--append-system-prompt` 注入统一提示词；Hermes 通过 Gateway `instructions` 字段注入；Codex 和 OpenClaw 保持现有协议字段结构，在输入层追加桥接提示。

Agent 可见的文件交付提示只应要求返回 Markdown 绝对路径引用，例如 `[filename.ext](absolute-local-path)`；`/get` 属于远端 IM 与连接器之间的内部取文件协议，不应写进 Agent prompt。

## 会话标识

Linco Connect 内部至少会同时处理三类标识：

| 标识 | 来源 | 用途 |
| --- | --- | --- |
| `sessionKey` | 远端 IM 或连接器生成 | 桥接层会话路由。 |
| `agentSessionId` | Agent CLI/Gateway 返回 | 恢复 Claude/Codex/Hermes/OpenClaw 的原生会话。 |
| `messageId` / `streamId` | 远端 IM 或连接器生成 | 绑定一次用户消息、流式回复和 `turn_end`。 |

新增功能时应保留这些标识，不要把 `_lincoMeta` 拼入用户正文或 Agent prompt。
