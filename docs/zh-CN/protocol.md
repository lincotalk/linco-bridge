# Protocol 公开协议

[English](../protocol.md)

本文档是首期开源版本的公开协议概览，用于说明连接器、reference platform 与兼容客户端之间共享的桥接概念，以及最小消息契约。

## 范围

- 传输层：连接器与兼容后端之间的已鉴权 WebSocket。
- 参与方：本地 Agent 连接器、兼容后端和兼容客户端。
- 目标：中继设备在线状态、用户输入、助手输出、工具/权限事件，以及客户端桥接体验所需的基础状态。

本概览不公开内部托管服务端点、签名私钥和部署侧风控规则。

## 鉴权

- 连接器连接到桥接 WebSocket 端点。
- 实际凭证通过查询参数 `token` 传递，格式为 `<appId>:<appSecret>`。
- 兼容后端应在接受桥接会话前校验该 token。

## 会话与选择器概念

- `agentType`：所选本地 Agent 类型，例如 `codex`、`claude`、`hermes`、`openclaw`。
- `sessionKey`：桥接层可见的会话标识，用于关联一次对话中的输入与输出。
- `streamId`：turn 级别的流标识，用于聚合分片输出并结束回复。
- `accountId`：当前桥接连接使用的凭证 / 账号标识。
- `profile` / `agentId`：某些本地工具所需的选择器，例如 Hermes profile 或 OpenClaw agent。

## 核心消息流程

1. 连接器与后端桥接 WebSocket 建立鉴权连接。
2. 后端确认桥接连接，并跟踪设备在线状态。
3. 客户端或后端向连接器发送 `inbound_message`。
4. 连接器将本次 turn 转发给所选本地 Agent。
5. 连接器可能先发送 `turn_start`、进度事件、流式分片，再发送最终回复帧。
6. 在某些场景下，权限确认、危险操作确认或停止当前 turn 的控制帧会在回合完成前插入。

## 常见帧类型

| 帧类型 | 方向 | 用途 |
| --- | --- | --- |
| `hello` | backend -> connector | 确认桥接连接和当前 bridge type |
| `ping` / `pong` | 双向 | 心跳与存活检测 |
| `presence_event` | connector -> backend | 上报在线 / 离线状态和可选设备元数据 |
| `inbound_message` | backend / client flow -> connector | 将用户消息发送到所选本地 Agent |
| `permission_response` | backend / client flow -> connector | 响应待处理的工具权限确认请求 |
| `danger_confirm` | backend / client flow -> connector | 响应危险操作确认请求 |
| `stop_turn` | backend / client flow -> connector | 取消当前正在执行的 turn |
| `turn_start` | connector -> backend / client flow | 表示连接器已开始处理当前 turn |
| `stream_chunk` | connector -> backend / client flow | 发送一次 turn 的部分助手输出 |
| `permission_request` | connector -> backend / client flow | 请求用户确认工具权限或执行门禁 |
| `danger_warning` | connector -> backend / client flow | 请求用户确认危险操作 |
| `outbound_message` | connector -> backend / client flow | 发送完整助手回复或文件回传消息 |
| `slash_command_result` | connector -> backend / client flow | 返回结构化本地命令结果，供前端渲染 |
| `agent_session` | connector -> backend / client flow | 表示 Agent 原生会话已建立或恢复 |
| `turn_end` | connector -> backend / client flow | 标记 turn 完成、取消或失败 |

## 兼容性说明

协议的具体 payload 可能会随着 release notes 演进。只要发生破坏性协议变更，就应同步更新仓库文档和发布说明。
