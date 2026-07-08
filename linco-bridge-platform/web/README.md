# Linco Bridge Web

UniApp 前端（H5 + 微信小程序），用于 Linco Bridge 自托管 Demo：连接本机 Agent CLI，完成桥接配置、Agent 落地页、流式聊天与历史管理。UI 与交互对齐 AIChat Flutter 客户端的 Bridge 模块。

> 配套后端见 [`../server/README.md`](../server/README.md)，整体联调见 [`../README.md`](../README.md)。

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Vue 3 + `<script setup lang="ts">` |
| 跨端 | UniApp（`@dcloudio/uni-app`） |
| 状态 | Pinia |
| 构建 | Vite 5 + `@dcloudio/vite-plugin-uni` |
| 质量 | ESLint 9 flat + Prettier + Vitest + vue-tsc |

## 快速开始

```bash
npm install
node scripts/generate-icons.mjs   # 首次或图标源变更后执行
npm run dev:h5                    # H5 开发，/api 代理到 :3300
```

先在本机启动 server（`cd ../server && npm run start:dev`），再打开 H5 开发地址。

微信小程序：

```bash
npm run dev:mp-weixin
npm run build:mp-weixin
```

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev:h5` | H5 开发服务器 |
| `npm run build:h5` | H5 生产构建 |
| `npm run dev:mp-weixin` | 微信小程序开发 |
| `npm run typecheck` | `vue-tsc --noEmit` |
| `npm run test` | Vitest 单元测试 |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run check` | typecheck + lint + format + test |

## 环境变量

在 `.env` / `.env.local` 中配置（参见 `src/env.d.ts`）：

| 变量 | 默认 | 说明 |
|------|------|------|
| `VITE_API_BASE_URL` | （空，同源） | REST 根地址；H5 dev 通常留空，走 Vite proxy |
| `VITE_USE_REMOTE_API` | `true` | 设为 `false` 时使用内存 Mock（纯 UI 调试） |
| `VITE_AGENT_CHAT_SDK` | — | 设为 `mock` 强制 AgentChat 走 Mock |

H5 开发代理（`vite.config.ts`）：

```text
/api → http://127.0.0.1:3300
```

## 页面与导航

底部 Tab：**消息** | **桥接**

| 路由 | 页面 | 说明 |
|------|------|------|
| `pages/messages/index` | 消息列表 | 全部 Bridge 聊天会话 |
| `pages/bridge/index` | 桥接首页 | Codex / Claude / Hermes / OpenClaw 入口卡片 |
| `pages/bridge/import-local` | 连接 Agent | 展示 setup 命令、检测连接 |
| `pages/bridge/import-openclaw` | OpenClaw 导入 | 上下文绑定流程 |
| `pages/chat/landing` | Agent 落地页 | 历史预览 + 输入开聊 |
| `pages/chat/index` | 聊天详情 | 流式消息、附件、工作区 / 设置 |
| `pages/chat/history` | 历史对话 | 完整 Agent 历史列表 |

## 目录结构

```text
src/
  api/                    # HTTP 客户端、session / agent-chat API
  bridge/
    constants.ts          # Agent 能力开关（工作区 / Profile / 设置）
    commands.ts           # linco-connect 命令模板（对齐 Flutter）
    types.ts              # Bridge / 会话 / 设置类型
    sdk/
      index.ts            # BridgeSdk REST 实现
      agent-chat.ts       # AgentChatSdk + Mock
  components/             # 通用 UI（输入栏、气泡、各类 Sheet）
  composables/            # 业务 hooks（连接、聊天、设置、附件…）
  constants/              # 图标路径等
  pages/                  # 路由页面
  stores/                 # Pinia（bridge / session）
  utils/                  # 格式化、picker 状态、Markdown 等
scripts/
  generate-icons.mjs      # 从 AIChat 资源生成 /static/icons
```

## SDK 与数据流

前端通过两层 SDK 访问后端，便于切换 Mock / REST：

```text
BridgeSdk        → /api/agent-bridges/*   （连接、状态、项目、settings）
AgentChatSdk     → /api/agent-chat/*      （落地页、历史、开聊）
Session API      → /api/sessions/*        （消息列表、流式发送）
```

Pinia `useBridgeStore` 持有 `BridgeSdk` 实例；`useSessionStore` 管理会话列表缓存。

## Agent 能力矩阵

与 Flutter Bridge 模块对齐。**功能变更时请同步更新本 README 与 `server/README.md`。**

| Agent | 工作区选择 | Profile / Agent 绑定 | 模型 + 推理设置 |
|-------|-----------|---------------------|----------------|
| Codex | ✅ 会话内可切换 | — | ✅（紧凑工具栏 `项目 \| 设置 ⌄`） |
| Claude | ✅ | — | ✅ |
| Hermes | — | **导入时一次性绑定**，一个 `appSecret` 对应一个 Profile，**不可切换** | — |
| OpenClaw | — | **导入时一次性绑定**，一个 `appSecret` 对应一个 Agent，**不可切换** | — |

### Hermes / OpenClaw 绑定规则

- 仅在 **导入连接页**（`import-local` / `import-openclaw`）选择并绑定 Profile / Agent
- 绑定后写入 `bridge_connections.bound_context_id`，聊天页 **不提供** AppBar Profile 切换入口
- 如需换 Profile / Agent，需重新走导入流程（新连接或重置绑定）

### Bridge 设置（Codex / Claude）

- 落地页 / 聊天输入栏：`临时会话 | 默认 ⌄`（有 pending 设置时显示模型 · 推理标签）
- 点击打开 `BridgeSettingsPickerSheet`：模型列表 + 推理强度（低 / 中 / 高 / 超高）
- 落地页：选择为 **pending state**，首条消息随 `startConversation.bridgeSettings` 提交
- 会话页：选择后调用 `updateBridgeSettings` 持久化并 apply 到 connector

相关文件：

- `composables/useBridgeSettings.ts`
- `components/BridgeSettingsPickerSheet.vue`
- `utils/bridge-settings.ts`

## 核心 Composables

| 模块 | 职责 |
|------|------|
| `useBridgeConnection` | 导入页连接检测、setup 刷新、**一次性** Profile / Agent 绑定 |
| `useAgentLanding` | 落地页数据、开聊 |
| `useChatSession` | 聊天加载、SSE 流、停止生成 |
| `useBridgeSettings` | 模型 / 推理选项预加载与 picker |
| `useProjectPicker` | Codex / Claude 工作区选择 |
| `useAttachmentPicker` | 图片 / 文件附件 |
| `useVoiceInput` | 语音输入（H5 需 HTTPS） |

## 核心组件

| 组件 | 说明 |
|------|------|
| `AgentLandingInput` | 落地页输入卡片（紧凑 Bridge 工具栏） |
| `ChatInputArea` | 会话页输入区 |
| `ChatBubble` / `MessageContent` | 消息渲染（Markdown、代码块、附件） |
| `BridgeSettingsPickerSheet` | 模型 + 推理设置底部弹层 |
| `BridgeWorkspacePickerSheet` | 工作区 / 会话选择 |
| `BridgeContextPickerSheet` | 导入页 Profile / Agent 列表（非会话内切换） |
| `AppOverlayHost` | 全局挂载各类 Sheet |

## 图标资源

静态图标位于 `static/icons/`，由脚本从 AIChat Flutter 资源同步生成：

```bash
node scripts/generate-icons.mjs
```

聊天输入栏图标常量见 `src/constants/chat-icons.ts`。

## 测试

```bash
npm test                              # 全部 Vitest
npm test -- bridge-settings constants # 指定模块
```

测试文件与源码同目录或放在 `*.spec.ts`，覆盖 utils、SDK 路由、constants 等纯逻辑。

## 开发说明

1. **先启 server 再启 web**，否则 Bridge / 聊天 API 会失败（除非 `VITE_USE_REMOTE_API=false` 纯 UI）。
2. **修改 `pages.json` 或新增页面** 后需重启 Uni dev server。
3. **流式聊天** 依赖后端 SSE；取消生成调用 `POST .../messages/cancel`。
4. **样式单位** 使用 `rpx`，与 Flutter `ScreenUtil` 设计稿（375×812）对应。
5. 与 Flutter 客户端共用 slash 命令语义，变更 `bridge/commands.ts` 时需同步 Flutter `linco-connect` 集成文档。
6. **文档维护**：变更 Agent 能力（工作区 / 绑定 / 设置等）时，必须同步更新 `web/README.md` 与 `server/README.md`。

## 范围说明

| 包含 | 不包含 |
|------|--------|
| Bridge 四 Agent 连接与聊天 | 账号登录 |
| H5 + 微信小程序构建 | 完整 IM 产品能力 |
| REST + SSE 真实联调 | 独立 Bridge SDK npm 发包 |
