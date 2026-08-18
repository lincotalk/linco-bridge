# Codex RPC 历史与跨端视频预览设计

## 背景

Codex 桌面会话历史原先直接解析本机 JSONL。迁移到 Codex app-server RPC 后，底层 `thread/list`、`thread/turns/list` 和 `thread/read` 已有初步实现，但 `/sessions`、`/bind`、`/history`、`/history-reload` 的异步命令生命周期没有完整接通，导致调用方可能在 `slash_command_result` 发送前结束本地命令。

本地文件预览链路目前通过 `/im/bridge-files/preview` 向 Connector 发送 `/get <path>`，Connector 读取文件并返回 Base64，服务端上传 OSS 后返回预览 URL。该链路存在两个问题：服务端会用 `sessionKey` 宽松匹配待处理请求，可能把同会话的预启动提示当成预览响应；同时服务端和 Flutter 客户端没有把 MP4 作为可播放视频处理。

## 目标与范围

本次实现以下能力：

1. Codex 会话列表、绑定和历史读取以 app-server RPC 为主路径，RPC 不可用时保留 JSONL 兼容回退。
2. 所有 RPC 历史命令继续输出既有 `slash_command_result`、`slash_command_result_chunk` 和 `turn_end` 桥接协议，服务端与客户端无需识别新的命令结果类型。
3. 文件预览响应按 `requestId` 或 `streamId` 严格关联，其他并发消息不能结束当前预览请求。
4. MP4/H.264 视频在 Web、Android 和 iOS 的文件预览页内播放。
5. 保持现有文件读取、Base64 传输、OSS 上传和约 50 MB 大小边界，不增加本地 HTTP 文件隧道。

本次不新增视频转码、缩略图生成、字幕、倍速、画中画或后台播放。`AIChat-Admin` 不参与该链路，不需要产品功能改动，只做构建与契约影响检查。

## 总体架构

采用“RPC-first + JSONL fallback + 严格请求关联 + 专用跨端播放器”方案。

```text
Flutter FilePreviewDialog
        |
        | POST /im/bridge-files/preview
        v
NestJS ImGateway -- requestId/streamId --> Connector /get
        ^                                      |
        | outbound_message + 同一关联 ID       | 读取本地文件并编码 Base64
        +--------------------------------------+
        |
        +-- 上传 OSS，返回 video/mp4 URL

Codex history command
        |
        +-- app-server RPC: thread/list -> thread/turns/list
        |                         \-> thread/read fallback
        |
        +-- RPC 不可用时 JSONL fallback
        |
        +-- slash_command_result(_chunk) -> turn_end
```

## Connector：Codex RPC 历史

### RPC 会话适配层

`src/agent/codex/sessions.js` 负责 app-server 进程通信和数据归一化：

- `thread/list` 获取当前工作目录可见的 Codex 会话，按更新时间倒序并应用命令限制。
- `thread/turns/list` 分页读取指定线程；若当前 app-server 不支持该方法，则使用 `thread/read` 获取完整线程后在本地分页。
- 将 RPC thread/turn/item 映射为现有 history round 结构，保留用户文本、助手文本、thinking 开关、时间和 RPC cursor。
- RPC cursor 必须绑定 agent 类型、session ID 和快照，跨会话、损坏或过期 cursor 返回现有历史 cursor 错误，不静默读取错误页面。

### 回退规则

以下情况允许回退 JSONL：app-server 无法启动、连接失败、RPC 方法不存在或明确报告不支持。RPC 成功但返回协议结构损坏时应返回可诊断错误，避免用旧文件掩盖协议兼容问题。

回退只影响数据来源，不改变 `/sessions`、`/bind`、`/history` 和 `/history-reload` 的返回数据结构。

### 异步命令生命周期

Codex 的历史相关 handler 返回 Promise，并由公共本地命令完成器统一等待。时序必须满足：

1. 完成 RPC 或 JSONL 回退读取。
2. 发送全部 `slash_command_result_chunk`（如有）。
3. 发送最终 `slash_command_result`。
4. 最后且仅一次发送 `turn_end`。

`/history-reload` 继续在历史同步后执行 Agent 重载，但历史结果不能因 warmup 的系统消息而丢失或提前结束。同步异常必须转换为现有 `error` 帧，并仍然完成本地命令。

## 服务端：预览关联与视频结果

### 严格请求关联

服务端创建预览请求时已经生成 `requestId` 和 `streamId`。Connector 通过现有 Linco 路由元数据将二者带回。因此匹配规则调整为：

1. 帧包含 `streamId` 时，只按 `streamId` 查找；未命中即忽略该帧。
2. 否则帧包含 `requestId` 时，只按 `requestId` 查找；未命中即忽略该帧。
3. 仅兼容确实不携带关联 ID 的旧 Connector 帧时，才允许按 `sessionKey` 回退。

预启动提示、历史同步提示和其他普通 `outbound_message` 即使来自同一 `sessionKey`，只要关联 ID 不同，就不能结束预览 Promise。正确关联的 `/get` 错误仍然立即返回 4xx；无媒体的无关文本帧被忽略。

### MP4 类型安全

`file-security.ts` 增加 `.mp4 -> video/mp4` 白名单。MP4 使用 ISO Base Media File Format 的 `ftyp` 签名校验，并依据扩展名区分 `.mp4` 视频和现有 `.m4a` 音频，避免把 MP4 一律识别为 `audio/mp4`。

### 视频预览响应

`buildBridgePreviewResult()` 对 `video/*` 或 `.mp4` 返回：

- `content: ''`
- `preview_url`: 可访问的 OSS 原文件 URL
- `online_preview_url: null`
- `preview_status: ready`
- `preview_error_code`、`preview_error_message`: `null`

若上传后没有 URL，则返回 `preview_status: failed` 和明确错误码。OSS 响应需保留正确的 `Content-Type: video/mp4`，并支持播放器所需的字节范围请求；不在应用服务内代理整个视频流。

## Flutter：Web、Android、iOS 视频播放器

客户端增加官方 `video_player` 依赖，并在 `FilePreviewDialog` 中将视频判断置于在线 Office/PDF 和文本/WebView 回退之前。视频来源使用服务端返回的 `previewUrl`，不读取 Base64 到内存。

播放器封装成独立、有状态的预览组件，负责 controller 初始化、监听和释放。行为如下：

- 默认不自动播放，初始化期间显示加载状态。
- 点击画面中央按钮或底部按钮切换播放/暂停。
- 展示当前时间、总时长和可拖动进度条。
- 支持静音/恢复；Web 与桌面宽屏可显示音量控制，移动端至少提供静音切换。
- 播放结束后显示重播入口。
- 初始化或播放失败时显示可理解的错误，并保留“下载”入口。
- 保持固定的播放器区域约束和视频宽高比，横竖屏及不同窗口宽度下不产生溢出。

MP4 容器与 H.264/AAC 作为首要验收组合。平台底层不支持的其他编码由播放器进入错误态，本次不做服务端转码。

## 数据与错误流

### 历史成功

`/history` -> Connector 调用 RPC -> 映射 rounds -> 发送既有命令结果 -> NestJS 按既有历史协议处理 -> Flutter 替换或追加历史消息。

### 历史降级

RPC 连接或方法不可用 -> 记录 warning -> JSONL reader -> 输出与 RPC 相同的 payload。JSONL 也失败时发送明确错误并结束命令，不留下 pending turn。

### 视频成功

Flutter 请求预览 -> NestJS 注册 pending request -> Connector `/get` 返回带同一关联 ID 的 `mediaBase64` -> 服务端校验 MP4、上传 OSS -> 返回 `ready` URL -> Flutter 初始化播放器。

### 并发消息

同一会话产生 warmup/history 文本帧 -> 因 `requestId`/`streamId` 不匹配被预览 pending 逻辑忽略 -> 等待真正的 `/get` 响应或超时。

## 测试策略

### Connector

- 使用 fake app-server 覆盖 `thread/list`、`thread/turns/list`、`thread/read` fallback、RPC cursor 和 JSONL fallback。
- 增加命令级测试，验证 `/sessions`、`/bind`、`/history`、`/history-reload` 在异步 RPC 下先发结果、后发一次 `turn_end`。
- 保留并运行现有本地命令生命周期回归测试，修复原有同步断言暴露出的真实时序问题。

### NestJS

- 先写失败测试，复现“相同 sessionKey、不同 requestId 的 warmup 文本抢占 MP4 预览”。
- 覆盖严格 ID 命中、带 ID 未命中不降级、无 ID 旧帧 sessionKey 兼容和正确关联错误帧。
- 覆盖 `.mp4/video/mp4` 签名校验、`.m4a/audio/mp4` 不回归、视频 `ready` payload 和 URL 缺失错误。

### Flutter

- Widget 测试覆盖视频分支选择、加载、初始化失败、播放/暂停、拖动、静音和重播状态。
- 在 Chrome、Android 和 iOS 分别用 MP4/H.264 样例做手工冒烟，确认可播放、可 seek、音频正常且退出预览后 controller 被释放。
- 运行 `flutter analyze` 和相关 Widget 测试；Web、Android、iOS 至少完成对应构建验证。

### 管理后台

- 本功能无代码改动。检查共享接口类型或构建是否受影响；若没有依赖关系，不制造无关提交。

## 验收标准

1. Codex `/sessions` 能通过 RPC 返回桌面会话，并可成功 `/bind`。
2. `/history` 和 `/history-reload` 能通过 RPC 返回历史消息，分页 cursor 可继续读取，结果帧早于且仅跟随一个 `turn_end`。
3. app-server 不可用或方法不支持时自动读取 JSONL，客户端收到相同形状的数据。
4. 并发 warmup/history 文本不能让 MP4 预览返回 400。
5. `.mp4` 被识别为 `video/mp4`，服务端返回 `preview_status: ready` 和可播放 URL。
6. 同一个 MP4/H.264 文件可在 Web、Android、iOS 预览，支持播放/暂停、进度拖动、时间、静音和重播，默认不自动播放。
7. 现有文本、图片、PDF、Office、音频和普通文件预览行为不回归。

