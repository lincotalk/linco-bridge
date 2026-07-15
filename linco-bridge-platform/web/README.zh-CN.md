# Linco Bridge Web

[English](README.md)

Linco Bridge 参考平台前端，基于 UniApp，支持 H5 与微信小程序。它负责桥接配置、Agent 落地页、聊天入口、会话浏览和流式聊天体验。

> 配套后端见 [`../server/README.zh-CN.md`](../server/README.zh-CN.md)，完整平台流程见 [`../README.zh-CN.md`](../README.zh-CN.md)。

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | Vue 3 + `<script setup lang="ts">` |
| 跨端 | UniApp |
| 状态管理 | Pinia |
| 构建 | Vite 5 + `@dcloudio/vite-plugin-uni` |
| 质量工具 | ESLint、Prettier、Vitest、vue-tsc |

## 快速开始

### 1. 先启动后端

```bash
cd linco-bridge-platform/server
npm install
npm run start:dev
```

确认后端可用：

```bash
curl http://127.0.0.1:3300/api/demo-config
```

### 2. 启动 H5 前端

```bash
cd linco-bridge-platform/web
npm install
npm run dev:h5
```

打开 Vite 输出的本地 H5 地址，然后进入 **桥接** Tab。

### 3. 可选：重新生成图标

除非你正在维护图标资源，否则可以跳过此步骤。

```bash
cd linco-bridge-platform/web
node scripts/generate-icons.mjs
```

### 4. 验证本地 H5 的 Codex 链路

1. 打开 **桥接**
2. 点击 **从 Codex 导入**
3. 复制页面生成的 `setupCommands`
4. 在本机终端执行这些命令
5. 回到页面点击 `我已复制，获取连接状态`
6. 等待页面确认连接成功
7. 点击 `进入 Codex` 进入聊天页
8. 如需选择项目、进入已有会话或新建会话，点击右上角文件夹图标
9. 发送测试消息，确认整条链路打通

> 以页面生成的 `setupCommands` 为准。本地开发场景通常会自动带上 `--channel linco-demo`，并可能包含 `--allow-insecure-ws`。

典型命令形态通常如下（仅供理解流程）：

```bash
npm install -g linco-connect
linco-connect init --token "demo-codex-app:demo-codex-secret" --agent codex --channel linco-demo --account codex_1 --allow-insecure-ws
linco-connect start --daemon
```

### 5. 官方 H5 / 微信小程序体验流程

如果你使用的是已经发布的 H5 或微信小程序入口，而不是本地开发环境，先按当前设备选择入口：

**在线 H5：** 打开 [https://bridge-demo.lincotalk.com](https://bridge-demo.lincotalk.com)。

**微信小程序：** 扫描下方体验码，或在微信直接搜索 `agent桥接器`。当前小程序版本默认使用**扫码登录**。

<p align="center">
  <img src="../../docs/images/demo/mini-program-qr.png" alt="Linco Bridge 微信小程序体验码" width="220" />
</p>

进入任一公开入口后：

1. 打开 **桥接**
2. 点击 **从 Codex 导入**
3. 复制页面生成的 `setupCommands`
4. 在本机终端执行这些命令
5. 回到页面点击 `我已复制，获取连接状态`
6. 等待页面确认连接成功
7. 点击 `进入 Codex` 进入聊天页
8. 如需选择项目、进入已有会话或新建会话，点击右上角文件夹图标
9. 发送测试消息，确认整条桥接链路已打通

说明：体验码可能会过期，请以仓库中的最新图片为准，也可以在微信直接搜索 `agent桥接器`。

### 6. 微信小程序工程调试与构建

```bash
npm run dev:mp-weixin
npm run build:mp-weixin
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev:h5` | H5 开发服务器 |
| `npm run build:h5` | H5 生产构建 |
| `npm run dev:mp-weixin` | 微信小程序开发（自动加载 `local.env`） |
| `npm run build:mp-weixin` | 微信小程序生产构建（自动加载 `prod.env`） |
| `npm run typecheck` | 类型检查 |
| `npm run test` | Vitest |
| `npm run lint` | ESLint |
| `npm run check` | typecheck + lint + format + test |

## 环境变量

生产构建（`build:h5` / `build:mp-weixin`）会自动加载仓库根目录 [`prod.env`](prod.env)，无需在命令行手写 `VITE_*`。

> **自托管注意：** [`prod.env`](prod.env) 中的 `VITE_API_BASE_URL` 仅用于官方在线 Demo 构建。二次开发请改为你的 Server 地址（或同域留空走 `/api`），**不要**指向 `https://bridge-demo.lincotalk.com`。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 见 `prod.env` | REST 根地址；与 API 同域时可留空 |
| `VITE_USE_REMOTE_API` | `true` | 设为 `false` 时使用内存 Mock |
| `VITE_AGENT_CHAT_SDK` | 空 | 设为 `mock` 时强制 AgentChat SDK 走 Mock |

本地 H5 开发不读 `prod.env`，`VITE_API_BASE_URL` 保持空，走 Vite 代理：

```text
/api → http://127.0.0.1:3300
```

微信小程序本地开发使用 [`local.env`](local.env)（默认 `http://127.0.0.1:3300`）：

```bash
# 终端 1：启动本地 server
cd linco-bridge-platform/server
npm run start:dev

# 终端 2：编译小程序（加载 local.env）
cd linco-bridge-platform/web
npm run dev:mp-weixin
```

微信开发者工具 → 详情 → 本地设置 → 勾选 **「不校验合法域名」**。真机预览时把 `local.env` 里的地址改成本机局域网 IP（如 `http://192.168.x.x:3300`）。

线上发布仍用 `prod.env`：`npm run build:mp-weixin`。

如果只做纯 UI 调试，不启动后端：

```bash
VITE_USE_REMOTE_API=false npm run dev:h5
```

## 主要页面

底部 Tab：`消息`、`助手`、`桥接`

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `pages/messages/index` | 消息列表 | 全部 bridge 聊天会话 |
| `pages/agents/index` | 助手 | 已连接的 Agent 账号与状态 |
| `pages/bridge/index` | 桥接首页 | Codex、Claude、Hermes、OpenClaw 入口卡片 |
| `pages/bridge/import-local` | 导入本地 Agent | 展示 setup 命令与连接检测 |
| `pages/bridge/import-openclaw` | OpenClaw 导入 | 上下文绑定流程 |
| `pages/chat/landing` | Agent 落地页 | 历史预览与首条提问 |
| `pages/chat/index` | 聊天详情页 | 流式消息、附件、工作区、设置 |
| `pages/chat/history` | 历史页 | 完整 Agent 历史列表 |

## 目录结构

```text
src/
  api/
  bridge/
    commands.ts
    constants.ts
    types.ts
    sdk/
  components/
  composables/
  constants/
  pages/
  stores/
  utils/
scripts/
  generate-icons.mjs
```

## SDK 流程

```text
BridgeSdk    → /api/agent-bridges/*
AgentChatSdk → /api/agent-chat/*
Session API  → /api/sessions/*
```

## Agent 能力矩阵

| Agent | 工作区选择 | 上下文绑定 | 模型与推理设置 | Slash 命令补全 |
| --- | --- | --- | --- | --- |
| Codex | 支持 | 不需要 | 支持 | 支持（`/help` 缓存） |
| Claude | 支持 | 不需要 | 支持 | 支持 |
| Hermes | 不支持 | 仅导入时绑定 | 不支持 | 支持 |
| OpenClaw | 不支持 | 仅导入时绑定 | 不支持 | 支持 |

### Hermes 与 OpenClaw 绑定规则

- 仅在导入阶段选择上下文。
- 一组 Demo 凭证绑定一个 Profile 或 Agent。
- 聊天页不支持切换已绑定的 Profile 或 Agent。

### Codex 与 Claude 的 Bridge 设置

- Agent 落地页和聊天输入区可以预加载模型与推理设置。
- 创建会话时，待应用设置会随首条消息一起提交。
- 在聊天中更新设置后，前端会持久化设置并通过连接器应用。

相关文件：

- `composables/useBridgeSettings.ts`
- `components/BridgeSettingsPickerSheet.vue`
- `utils/bridge-settings.ts`

### Slash 命令（全部 Bridge Agent）

- Agent 落地页和聊天页通过 `/help` 预加载命令。
- 前端先读取缓存命令，再从连接器刷新。
- 在输入框键入 `/` 时，会根据缓存命令显示补全建议。

相关文件：

- `composables/useSlashCommands.ts`
- `composables/useSlashCommandInput.ts`
- `components/SlashCommandSuggestionPanel.vue`
- `bridge/slash-command.ts`
- `utils/slash-command-cache.ts`

## 核心 Composables

| 模块 | 职责 |
| --- | --- |
| `useBridgeConnection` | 导入页连接检测、配置刷新和一次性上下文绑定 |
| `useAgentLanding` | Agent 落地页数据和会话创建 |
| `useChatSession` | 聊天加载、SSE 流式响应和停止生成 |
| `useBridgeSettings` | 模型与推理选项预加载及选择器状态 |
| `useSlashCommands` | `/help` 预加载、缓存和命令建议数据源 |
| `useProjectPicker` | Codex 与 Claude 工作区选择 |
| `useAttachmentPicker` | 文件和图片附件选择 |
| `useVoiceInput` | 在支持的 H5 环境中提供语音输入 |

## 核心组件

| 组件 | 说明 |
| --- | --- |
| `AgentLandingInput` | 带精简 Bridge 工具栏的 Agent 落地页输入卡片 |
| `ChatInputArea` | 聊天页输入区域 |
| `ChatBubble` / `MessageContent` | 消息渲染，包括 Markdown、代码和附件 |
| `BridgeSettingsPickerSheet` | 模型与推理设置底部选择器 |
| `SlashCommandSuggestionPanel` | `/` 命令输入建议面板 |
| `BridgeWorkspacePickerSheet` | 工作区与会话选择器 |
| `BridgeContextPickerSheet` | Hermes 与 OpenClaw 导入页上下文列表 |
| `AppOverlayHost` | Sheet 和 Overlay 的全局挂载容器 |

## 图标资源

正常体验时，直接使用仓库中已提交的图标资源即可。

仅在需要重生成时执行：

```bash
node scripts/generate-icons.mjs
```

## 测试

```bash
npm test
```

## 说明

1. 真实联调时必须先启 `server` 再启 `web`
2. 修改 `pages.json` 或新增页面后，需要重启 UniApp 开发服务
3. 流式聊天依赖后端 SSE
4. 如果 Agent 能力行为发生变化，请同步更新本文件与 [`../server/README.zh-CN.md`](../server/README.zh-CN.md)

## H5 与微信小程序差异

本项目按 **UniApp 跨端思路** 开发：业务层统一走 `uni.request` / `uni.storage`，浏览器专用 API 只在 H5 分支或 `platform-runtime` 中封装。

| 能力 | H5 | 微信小程序 |
| --- | --- | --- |
| HTTP | Vite 代理 + Cookie 会话 | 绝对 URL + `X-Linco-Visitor-Session` header |
| 访客 ID / Session | `localStorage` + Cookie | `uni.setStorageSync` |
| 流式聊天 | `fetch` + SSE | 阻塞 HTTP（等 Agent 完整回复后一次展示） |
| 取消生成 | `AbortController` | 自研 `CancelToken` |
| 滚动到底 | `requestAnimationFrame` | `setTimeout`（条件编译） |
| 外链打开 | `window.open` | 复制链接 / `uni.downloadFile` + `openDocument` |
| 语音输入 | Web Speech API | 暂不支持（需微信录音 API） |

**重要**：H5 与小程序是**独立访客会话**，桥接连接不共享。小程序端需在本机重新执行 `linco-connect` 并完成连接检测，才能看到助手与聊天数据。

聊天发送**不依赖客户端 WebSocket**（WebSocket 仅用于本机 `linco-connect` 连接器与平台通信）。小程序通过 `uni.request` 调用 HTTP API；纯文本消息默认走阻塞接口，Agent 回复完成后一次性展示（仍可能显示「正在思考」，直到本机 Agent 返回）。

本地调试小程序时：

1. 微信开发者工具勾选 **不校验合法域名**
2. 使用 `local.env` 指向可访问的后端地址
3. 修改代码后 **清缓存并重新编译**
