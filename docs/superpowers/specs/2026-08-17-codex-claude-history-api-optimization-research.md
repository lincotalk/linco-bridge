# Codex / Claude 会话与历史读取优化调研

> 状态：调研完成，待开发评审，尚未实施
> 调研日期：2026-08-17
> 适用范围：`linco-bridge-connect` 的项目会话列表、会话绑定和历史同步

## 1. 背景

Linco Bridge 当前对不同 Agent 的本地会话发现和历史读取方式不一致：

- DeepSeek 模式通过 Harness RPC 获取项目、会话和历史事件。
- Codex 模式主要读取 `.codex` 下的 SQLite、JSONL 和桌面端状态文件。
- Claude 模式直接扫描 `.claude/projects` 并解析会话 JSONL。

DeepSeek Harness 已证明，使用提供方维护的结构化接口可以降低 Bridge 对私有存储格式的耦合。本调研确认 Codex 和 Claude 是否存在类似能力，并给出后续优化的建议边界。

本文只提供实现决策依据，不代表已经决定替换现有逻辑。

## 2. 结论摘要

### 2.1 Codex

Codex app-server 已提供可直接使用的结构化接口：

- 稳定接口 `thread/list`：分页查询会话及元数据。
- 稳定接口 `thread/read`：通过 `includeTurns: true` 读取完整会话历史。
- 实验接口 `thread/turns/list`：按 turn 分页读取历史，最接近 DeepSeek Harness 的 `session.history`。

Codex 模式适合迁移为“app-server 接口优先、本地文件解析兜底”。但不能立即删除所有文件读取逻辑，因为：

- `thread/list` 没有 Codex Desktop 的 `projectId` 过滤能力。
- 当前项目归属还依赖 `.codex-global-state.json` 中的桌面端 assignment。
- `thread/turns/list` 仍是实验接口，需要兼容旧 Codex 版本。

### 2.2 Claude

Claude 没有与 Codex app-server 等价的常驻本地历史 RPC 服务，但官方 Agent SDK 提供：

- `listSessions()`
- `getSessionInfo()`
- `getSessionMessages()`
- `getSubagentMessages()`

这些是官方结构化库接口，但官方类型说明明确指出：默认实现仍读取并解析本地 JSONL。它的价值是把存储格式、父子消息链和 worktree 处理交给 Anthropic 官方 SDK，而不是消除本地文件依赖。

Claude 会话列表适合优先评估迁移到 SDK。历史读取暂不建议直接完全替换现有实现，因为 SDK 只有从头开始的 `offset + limit`，没有“最近 N 轮”、倒序游标或快照游标，长会话可能产生性能回退。

### 2.3 推荐方向

采用分提供方、分阶段的混合方案：

1. Codex 会话列表和历史优先走 app-server，保留本地存储兜底。
2. Claude 会话列表优先走 Agent SDK。
3. Claude 历史继续保留当前尾部扫描，等 SDK 提供倒序或游标分页后再评估完全迁移。
4. 所有提供方最终统一输出 Bridge 的 canonical history rounds，不改变前端协议。

## 3. 当前实现

### 3.1 公共历史链路

当前 `/sessions`、`/bind`、`/history` 和 `/history-reload` 主要由以下模块负责：

- `linco-bridge-connect/src/command/history/handlers.js`
- `linco-bridge-connect/src/command/history/sessions.js`
- `linco-bridge-connect/src/command/history/readers.js`
- `linco-bridge-connect/src/command/history/payloads.js`
- `linco-bridge-connect/src/runtime/agentRunner.js`

DeepSeek 已通过 provider adapter 实现异步会话与历史读取，可作为后续统一 provider 能力边界的参考。

### 3.2 Codex 当前实现

会话列表：

1. 读取 `.codex/session_index.jsonl` 获取标题等索引信息。
2. 读取 `.codex/.codex-global-state.json` 获取桌面端项目与 thread assignment。
3. 优先只读查询最新的 `.codex/state_*.sqlite`。
4. SQLite 不可用或记录缺失时扫描 `.codex/sessions/**/*.jsonl`。

历史读取：

1. 根据 thread ID 定位 rollout JSONL。
2. 使用尾部字节扫描获取最近记录。
3. 解析 `event_msg`、`response_item`、user message、final answer、reasoning 和附件。
4. 使用 Bridge 自有游标保存快照大小和字节边界。

优点是性能可控、兼容性覆盖充分；缺点是 Bridge 需要了解 Codex 的 SQLite schema、JSONL 记录类型和桌面端状态格式。

### 3.3 Claude 当前实现

会话列表：

1. 将 workspace 编码为 `.claude/projects/<encoded-workspace>`。
2. 扫描该目录下的 `*.jsonl`。
3. 从头部和尾部记录提取首条消息、最后提示和标题。

历史读取：

1. 使用公共尾部字节扫描器读取最近记录。
2. 过滤 IDE context、本地命令、tool result 和控制消息。
3. 提取真实用户输入、助手文本、thinking、图片和文档。
4. 输出 Bridge history rounds 和稳定分页游标。

## 4. 提供方能力对比

| 能力 | DeepSeek Harness | Codex app-server | Claude Agent SDK |
|---|---|---|---|
| 接口形态 | HTTP/RPC 服务 | 本地 JSON-RPC 服务 | JavaScript/Python 库 |
| 会话列表 | 有 | `thread/list` | `listSessions()` |
| 单会话元数据 | 有 | `thread/read` | `getSessionInfo()` |
| 历史读取 | `session.history` | `thread/read` | `getSessionMessages()` |
| 历史分页 | `beforeSeq` | `thread/turns/list`（实验） | `offset + limit` |
| 倒序读取最近历史 | 支持 | 支持 | 不直接支持 |
| 结构化消息 | 支持 | 支持 | 支持 |
| 提供方内部仍读本地文件 | Harness 自行管理 | app-server 自行管理 | 是，SDK 文档明确说明 |
| Bridge 是否仍需转换 rounds | 是 | 是 | 是 |

## 5. Codex app-server 调研

### 5.1 已验证版本

- 本机 `codex-cli`：`0.144.5`
- 初始化 capability：`experimentalApi: true`
- 已通过真实只读 RPC 验证 `thread/list`、`thread/read` 和 `thread/turns/list`

Bridge 当前已经具备 app-server 生命周期与通用 RPC 基础：

- `ensureAppServer()` 启动或复用 Codex app-server。
- `rpcRequest()` 管理请求 ID、pending promise 和超时。
- 初始化时已经声明 `experimentalApi: true`。

因此 Codex 侧改造不需要引入第二套进程通信机制。

### 5.2 `thread/list`（稳定）

请求示例：

```json
{
  "method": "thread/list",
  "params": {
    "cwd": "D:\\kaiyuan\\linco-bridge",
    "limit": 50,
    "sortKey": "updated_at",
    "sortDirection": "desc"
  }
}
```

主要参数：

- `cwd`: 单一路径或路径数组，按会话记录的 cwd 精确过滤。
- `limit`: 分页大小。
- `cursor`: opaque cursor。
- `sortKey`: `created_at`、`updated_at` 或 `recency_at`。
- `sortDirection`: `asc` 或 `desc`。
- `sourceKinds`: CLI、VSCode、appServer、subAgent 等来源过滤。
- `useStateDbOnly`: 为 true 时只读 state DB，不扫描 JSONL 修复元数据。

返回：

- `data`: Thread 元数据数组。
- `nextCursor`: 下一页游标。
- `backwardsCursor`: 反向分页游标。

Thread 元数据包括 `id`、`name`、`preview`、`cwd`、`createdAt`、`updatedAt`、`recencyAt`、`source`、`status`、`gitInfo` 和 `path` 等。

注意：`thread/list` 的 `cwd` 是精确匹配，Bridge 当前的 realpath、Windows 路径别名和项目 assignment 语义仍需保留。

### 5.3 `thread/read`（稳定）

请求示例：

```json
{
  "method": "thread/read",
  "params": {
    "threadId": "<thread-id>",
    "includeTurns": true
  }
}
```

返回完整 `thread`，`includeTurns: true` 时包含 persisted turns 和 ThreadItems。该接口适合作为实验分页接口不可用时的稳定回退。

限制：没有 limit 或 cursor，长会话会一次性装载全部历史。

### 5.4 `thread/turns/list`（实验）

请求示例：

```json
{
  "method": "thread/turns/list",
  "params": {
    "threadId": "<thread-id>",
    "limit": 20,
    "sortDirection": "desc",
    "itemsView": "full"
  }
}
```

主要参数：

- `cursor`: opaque cursor。
- `limit`: turn 分页大小。
- `sortDirection`: 默认倒序。
- `itemsView`: `notLoaded`、`summary` 或 `full`。

返回 `data`、`nextCursor` 和 `backwardsCursor`。实测当前版本能够正常返回倒序 turn 页面及游标。

调用方不得解析或拼接 cursor，应将其视为 opaque string。

### 5.5 Codex items 到 Bridge rounds 的映射

建议按 item 顺序扫描，不要假设一个 Codex turn 等于一个 Bridge 对话轮次。真实历史中一个 turn 可能包含多个 `userMessage`，也可能包含 commentary、reasoning、工具调用和文件修改。

建议映射：

| Codex ThreadItem | Bridge 处理 |
|---|---|
| `userMessage` | 开始新的用户轮次，提取文本和结构化附件 |
| `agentMessage` + `phase=final_answer` | 作为助手最终回复 |
| `agentMessage` + commentary phase | 默认不进入正文；请求 thinking 时可映射为 progress |
| `reasoning` | 请求 thinking 时映射 summary/content |
| tool call、file change、MCP call | 默认不进入正文，可保留为调试或扩展元数据 |
| image view / image generation | 按现有附件安全协议转换，不直接携带未校验正文 |

分页单位是 turn，而 UI 限制单位是 round。实现需要循环拉取页面，直到得到足够 round、没有下一页或达到保护上限。

## 6. Claude Agent SDK 调研

### 6.1 已验证版本

- 本机 Claude Code：`2.1.220`
- 官方包 `@anthropic-ai/claude-agent-sdk`：`0.3.233`
- 已通过官方 SDK 对本机存量会话执行只读验证

验证结果：

- `listSessions()` 返回 session ID、summary、cwd、git branch 和 lastModified。
- `getSessionMessages()` 返回按对话链排序的 `user`、`assistant` 和可选 `system` 消息。
- 消息内容中仍包含 thinking、tool use 和 tool result，需要 Bridge 继续过滤。

### 6.2 `listSessions()`

示例：

```js
const sessions = await listSessions({
  dir: workspace,
  limit: 50,
  offset: 0,
  includeWorktrees: true,
  includeProgrammatic: false,
});
```

主要参数：

- `dir`: 项目目录；省略时跨全部项目查询。
- `limit` / `offset`: 从排序结果集开头分页。
- `includeWorktrees`: 包含当前 Git 仓库的 worktree 会话，默认 true。
- `includeProgrammatic`: 是否包含 SDK、daemon 等 headless 会话。
- `sessionStore`: alpha，允许替换本地文件存储。

返回的 `SDKSessionInfo` 包含：

- `sessionId`
- `summary`
- `lastModified`
- `fileSize`
- `customTitle`
- `firstPrompt`
- `gitBranch`
- `cwd`
- `tag`
- `createdAt`

如目标是模拟 Claude Code `/resume` 或 IDE 会话选择器，建议显式使用 `includeProgrammatic: false`。

### 6.3 `getSessionInfo()`

按 session ID 读取单个会话元数据，可传 `dir` 缩小查询范围。与全项目扫描相比，更适合 `/bind` 时验证指定 session 是否属于项目。

### 6.4 `getSessionMessages()`

示例：

```js
const messages = await getSessionMessages(sessionId, {
  dir: workspace,
  limit: 100,
  offset: 0,
  includeSystemMessages: false,
});
```

官方类型说明明确指出该函数：

1. 读取会话 JSONL transcript。
2. 根据 `parentUuid` 构建实际 conversation chain。
3. 按时间顺序返回用户和助手消息。

`SessionMessage` 包含 `type`、`uuid`、`session_id`、`message`、`parent_tool_use_id` 和 `parent_agent_id`。

SDK 的优势：

- 官方维护 JSONL 格式兼容。
- 正确构建 parent UUID 链，优于仅按文件物理顺序扫描。
- 能统一处理 worktree、会话标题和 programmatic session。

SDK 的限制：

- `offset` 从历史开头计算，没有 newest-first 或 opaque cursor。
- 没有直接返回总消息数。
- `limit` 限制的是原始消息数，不是 Bridge 对话轮次。
- 返回的 user 消息可能只是 `tool_result`，assistant 消息可能只是 thinking 或 `tool_use`。
- 为得到“最近三轮”，长会话可能需要读取完整 conversation chain 后再截取。

因此，SDK 当前不能无损替代 Bridge 已实现的尾部字节扫描和快照游标。

### 6.5 Claude 消息到 Bridge rounds 的映射

建议复用当前过滤语义：

- user message 中只包含 `tool_result` 时，不创建用户轮次。
- 排除 IDE context、本地命令和纯控制消息。
- assistant 内容中的 text 进入正文。
- thinking 仅在 `/history --thinking` 时返回。
- `tool_use` 不直接进入助手正文。
- image/document 继续使用现有安全附件结构。
- system messages 默认不请求；需要 compact boundary 时再单独设计。

## 7. 推荐目标架构

### 7.1 Provider 能力边界

建议将会话和历史读取归属到各 Agent provider，而不是继续在通用 command handler 中判断底层存储格式：

```text
listProjects(session, config)
listProjectSessions(session, config, options)
findProjectSession(session, config, options)
readSessionHistory(session, config, options)
```

DeepSeek 已具备类似实现。Codex 和 Claude 可逐步接入，公共 command 层只负责：

- 参数解析和项目访问校验。
- session 绑定。
- canonical history payload。
- turn_end 和错误收口。

### 7.2 Canonical history 结果

各 provider 最终应返回统一结构：

```js
{
  rounds: [
    {
      ordinal,
      user,
      assistant,
      userFiles,
      assistantFiles,
      userTimestamp,
      assistantTimestamp,
      thinkingItems,
      sourceIdentity,
    },
  ],
  pageInfo: {
    hasMore,
    nextCursor,
    snapshotId,
  },
  syncMeta: {
    strategy,
    providerVersion,
    fallbackUsed,
  },
}
```

`nextCursor` 是 Bridge 对外游标。内部可以封装 provider cursor、方向、session token 和版本信息，但不得把 provider cursor 的内部格式暴露给前端解析。

### 7.3 Provider 策略

Codex：

```text
会话列表: thread/list
  -> 合并 Desktop project assignment
  -> 失败时 state SQLite
  -> 最后 JSONL

历史: thread/turns/list（能力探测）
  -> 不支持时 thread/read(includeTurns=true)
  -> 失败时现有 JSONL tail parser
```

Claude：

```text
会话列表: Agent SDK listSessions
  -> 失败时现有目录扫描

指定会话: Agent SDK getSessionInfo
  -> 失败时现有 transcript 定位

历史: 当前 JSONL tail parser
  -> 可选实验开关使用 getSessionMessages 做一致性对照
  -> SDK 获得倒序/游标能力后再考虑切主路径
```

## 8. 分阶段实施建议

### 阶段 0：建立基线

- 固化 Claude/Codex 当前会话列表和历史 payload fixture。
- 覆盖普通会话、worktree、项目重分配、subagent、compact、thinking、附件和长会话。
- 记录当前扫描耗时、扫描字节数、内存峰值和失败率。

### 阶段 1：Codex 会话列表接口化

- provider 新增 `listProjectSessions()`。
- 使用 `thread/list` 获取基础 Thread 元数据。
- 保留 Desktop assignment 合并和路径别名处理。
- API 失败或版本不支持时回退现有 SQLite/JSONL。

### 阶段 2：Codex 历史接口化

- 运行时探测 `thread/turns/list`，不要只根据版本号判断。
- 实验接口成功时使用倒序分页和 `itemsView: full`。
- 不支持时调用稳定的 `thread/read`。
- 两者失败时回退 JSONL tail parser。
- 对比 API 路径与旧解析路径的 rounds，发现差异时记录元数据而非消息正文。

### 阶段 3：Claude 会话列表 SDK 化

- 引入官方 Agent SDK，确认 CommonJS 工程中的 ESM 动态导入策略。
- 使用 `listSessions({ dir, includeWorktrees: true, includeProgrammatic: false })`。
- `/bind` 优先使用 `getSessionInfo()` 做项目归属验证。
- 保留目录扫描 fallback。

### 阶段 4：Claude 历史对照评估

- 在非默认实验开关下同时运行 SDK parser 和旧 parser。
- 比较 round 数量、用户文本 identity、最终回复、thinking 和附件元数据。
- 重点验证 resume/fork 后 parent UUID 链与物理文件顺序不一致的场景。
- 评估长会话全量加载成本。
- 未解决最近历史分页前，不删除尾部扫描器。

### 阶段 5：清理旧路径

只有在以下条件全部满足后，才考虑删除某一 provider 的旧解析路径：

- 支持的最低 provider 版本都具备目标接口。
- 线上 fallback 使用率持续接近零。
- 会话列表和 history parity 测试长期稳定。
- 项目 assignment、worktree、附件和分页语义已完全覆盖。

## 9. 兼容与降级要求

- 能力探测优先于静态版本判断。
- “method not found”、schema 不兼容、RPC 超时和 provider 进程不可用必须回退。
- 回退不能改变 `/sessions`、`/bind`、`/history`、`/history-reload` 的外部协议。
- 同一分页链路中不能无提示切换数据源；需要重置 snapshot 或返回可识别的 cursor invalid。
- API 和文件 parser 返回的稳定消息 identity 应尽可能一致，避免前端重复导入。
- provider 接口失败时日志只记录 method、版本、耗时、数量和错误码，不记录完整消息正文或本地敏感路径。

## 10. 性能与安全

### 性能

- Codex `thread/read` 可能一次加载完整长会话，应优先使用分页接口。
- Codex turn 数与 Bridge round 数不等，需要设置最大翻页次数和最大原始 item 数。
- Claude `getSessionMessages` 可能全量建立 parent UUID 链，必须对大文件做基准测试。
- 保留现有缓存上限和历史 payload 分片机制。

### 安全

- 项目路径仍需经过现有可读目录校验和规范化。
- 根据 session ID 查询时必须验证 session 属于当前项目，不能仅因 provider 返回记录就允许绑定。
- 历史附件继续使用 metadata-only payload 和显式 `/get` 流程。
- 不把 base64、`data:` URI、provider 凭据或完整本地私有路径写入普通日志。
- SDK/API 返回内容仍视为不可信输入，进入 Bridge payload 前必须做类型、长度和数量限制。

## 11. 测试与验收标准

### Codex

- `thread/list` 能列出当前项目普通会话并排除 subagent。
- Desktop assignment 指向当前项目但 cwd 不完全相同时仍能正确显示。
- Windows 大小写、realpath、长路径前缀和 symlink/worktree 不产生重复或漏项。
- `thread/turns/list` 最近页、上一页、空页和游标失效行为正确。
- 一个 turn 内出现多个 `userMessage` 时能生成多个正确 round。
- commentary 不进入 final answer，reasoning 只在请求时返回。
- 实验接口不可用时自动回退 `thread/read`，再回退 JSONL。

### Claude

- `listSessions` 与 Claude Code `/resume` 可见会话保持一致。
- `includeProgrammatic: false` 能排除 SDK/daemon 会话。
- worktree 会话项目归属正确。
- `getSessionInfo` 不能把其他项目 session 绑定到当前项目。
- 旧 parser 正确处理真实用户消息、tool result、thinking、图片和文档。
- resume/fork 分支历史按 parent UUID chain 命中预期对话链。
- 大会话性能不低于当前已接受阈值。

### 公共协议

- `replaceConversation`、thinking、附件、pageInfo 和 syncMeta 保持兼容。
- history result 分片、turn_end 顺序和错误收口保持兼容。
- 前端重复同步不产生重复消息。
- provider 不可用或升级失败时，用户仍能通过 fallback 看到历史。

## 12. 待评审问题

1. Codex 实验接口是否允许作为默认主路径，还是只在配置开关下启用？
2. Codex Desktop project assignment 是否应继续由 Bridge 读取，还是等待 app-server 增加 project filter？
3. Claude Agent SDK 是否作为 connector 的生产依赖，还是可选依赖？
4. Claude 最新历史是否继续使用当前 byte cursor，还是接受 SDK 全量读取的成本？
5. API 路径和文件路径产生不同 stable identity 时，以哪一套为迁移基准？
6. 是否需要在 `syncMeta.strategy` 中公开具体 provider 路径，方便灰度和问题定位？

## 13. 调研来源

- Codex App Server 官方文档：<https://developers.openai.com/codex/app-server>
- 本机 Codex `app-server generate-json-schema` 生成的稳定与实验协议 schema
- Claude Agent SDK 官方包：<https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk>
- `@anthropic-ai/claude-agent-sdk@0.3.233` 官方 TypeScript declarations
- 本机 Claude Code `2.1.220` CLI 帮助与官方 SDK 只读验证
- Linco Bridge 当前 `sessions.js`、`readers.js`、Codex provider 和 DeepSeek provider 实现

## 14. 非目标

- 本文不要求立即修改现有代码。
- 本文不要求删除现有 SQLite/JSONL fallback。
- 本文不改变 Bridge history payload 或前端展示协议。
- 本文不修改 DeepSeek Harness、Codex 或 Claude Code 的源码。
