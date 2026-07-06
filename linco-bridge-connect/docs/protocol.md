# Linco Connect 协议说明

本文描述 `linco-bridge-connect` 与远端 IM 之间的主要消息约定。代码入口主要在 `src/channels/bridge/protocolAdapter.js`、`src/channels/bridge/connector.js` 和 `packages/protocol/src`。

## 通用字段

桥接事件通常包含以下字段：

| 字段 | 说明 |
| --- | --- |
| `type` | 消息类型。 |
| `channel` | 远端 channel 名称，默认 `linco`。 |
| `accountId` | 当前账号。 |
| `agentId` | 当前 Agent 标识。 |
| `sessionKey` | 桥接层会话 ID。 |
| `messageId` | 原始 IM 消息 ID。 |
| `streamId` | 一次回复流的 ID。未提供时通常由 `messageId` 派生。 |
| `ts` | 毫秒时间戳。 |

## 入站消息

远端 IM 发给连接器的消息类型包括：

| 类型 | 说明 |
| --- | --- |
| `ping` / `pong` | 心跳。 |
| `inbound_message` | 用户消息。 |
| `danger_confirm` | 用户对危险操作的确认结果。 |
| `permission_response` | 用户对工具权限请求的确认结果。 |
| `stop_turn` | 停止当前回合。 |

`inbound_message` 常用字段：

```json
{
  "type": "inbound_message",
  "sessionKey": "s-1",
  "messageId": "m-1",
  "streamId": "linco-stream-m-1",
  "text": "用户输入",
  "files": [
    {
      "name": "report.pdf",
      "mimeType": "application/pdf",
      "base64": "..."
    }
  ],
  "agentId": "main",
  "accountId": "default"
}
```

附件也兼容旧字段 `mediaName`、`mediaType`、`mediaUrl`、`mediaBase64`。连接器会统一转换为内部 attachments。

## 出站消息

连接器返回给远端 IM 的主要事件包括：

| 类型 | 说明 |
| --- | --- |
| `turn_start` | 当前用户消息开始处理。 |
| `stream_chunk` | 助手回复流式增量。 |
| `thinking` / `thinking_clear` | 推理、规划或思考内容。 |
| `agent_task` | Agent 任务级进度。 |
| `agent_action` | Agent 行动、补丁、编辑等结构化进度。 |
| `tool_call` / `tool_result` | 工具调用开始和完成。 |
| `permission_request` | 请求用户确认工具权限。 |
| `danger_warning` | 请求用户确认危险操作。 |
| `outbound_message` | 普通系统消息、错误消息、文件下发或非流式回复。 |
| `slash_command_result` | 本地斜杠命令的结构化结果。 |
| `agent_session` | Agent 原生会话已建立或恢复。 |
| `context_compaction` | 上下文整理进度。 |
| `turn_end` | 当前回合结束。 |

远端 IM 应以 `turn_end` 作为一次用户消息处理完成的最终信号。即使本地命令只返回结构化结果，也会以 `turn_end` 收尾。

## 流式回复

`stream_chunk` 使用 `delta` 表示本次增量，`fullText` 表示当前完整文本，`done` 表示该回复流是否结束。

```json
{
  "type": "stream_chunk",
  "sessionKey": "s-1",
  "messageId": "m-1",
  "streamId": "linco-stream-m-1",
  "mode": "chunk",
  "delta": "你好",
  "fullText": "你好",
  "done": false
}
```

当 `done: true` 时，事件可能带有 `references`，用于展示 Agent 生成文件的可点击引用。

## 斜杠命令结果

`slash_command_result` 用于列表、历史、模型、设置等结构化 UI。

```json
{
  "type": "slash_command_result",
  "command": "history",
  "version": 1,
  "sessionKey": "s-1",
  "streamId": "linco-stream-m-1",
  "data": {
    "rounds": []
  }
}
```

前端应按 `command` 分发渲染逻辑。无法识别的 `command` 可以回退为普通 JSON 或文本摘要。

## 权限与危险操作

Agent 适配器可能发送 `permission_request` 或 `danger_warning`。远端 IM 应让用户明确确认，然后回传：

```json
{
  "type": "permission_response",
  "sessionKey": "s-1",
  "requestId": "req-1",
  "approved": true
}
```

```json
{
  "type": "danger_confirm",
  "sessionKey": "s-1",
  "approved": false
}
```

## 文件下发

Agent 生成文件时通常先在回复中返回文件路径引用。远端 IM 点击引用后可以发送 `/get <路径>`，连接器校验路径、文件类型和大小后返回 `outbound_message`，其中包含 `mediaBase64` 或 `files`。

连接器只应下发当前工作目录、会话运行目录或附件目录内的普通文件。

## 内部元数据

`_lincoMeta` 是连接器内部路由信息，不是协议正文。Agent 适配器在构造 prompt 时必须过滤 `type: "meta"` 和 `_lincoMeta`，远端 IM 也不应把这些字段拼入用户 `text`。
