# Linco Bridge Web

[简体中文](README.zh-CN.md)

UniApp frontend for the Linco Bridge reference platform. It provides the bridge setup flow, Agent landing page, chat entry, session browsing, and streaming chat experience for H5 and WeChat Mini Program.

> See [`../server/README.md`](../server/README.md) for the backend and [`../README.md`](../README.md) for the full platform walkthrough.

## Stack

| Category | Choice |
| --- | --- |
| Framework | Vue 3 + `<script setup lang="ts">` |
| Cross-platform | UniApp |
| State | Pinia |
| Build | Vite 5 + `@dcloudio/vite-plugin-uni` |
| Quality | ESLint, Prettier, Vitest, vue-tsc |

## Quick Start

### 1. Start the backend first

```bash
cd linco-bridge-platform/server
npm install
npm run start:dev
```

Check that the backend is ready:

```bash
curl http://127.0.0.1:3300/api/demo-config
```

### 2. Start the H5 frontend

```bash
cd linco-bridge-platform/web
npm install
npm run dev:h5
```

Open the local H5 URL printed by Vite, then enter the **Bridge** tab.

### 3. Optional: regenerate icons

Skip this step unless you are maintaining icon assets.

```bash
cd linco-bridge-platform/web
node scripts/generate-icons.mjs
```

### 4. Validate the local H5 Codex flow

1. Open **Bridge**.
2. Click **Import from Codex**.
3. Copy the generated `setupCommands`.
4. Run the commands in a local terminal.
5. Return to the page and click `I have copied it, get connection status`.
6. Wait until the page confirms the connector is online.
7. Click `Enter Codex` to enter the chat page.
8. Use the folder icon in the top-right corner to choose a project, open an existing session, or create a new session with `+`.
9. Send a test message to verify the full chain.

> Always use the page-generated `setupCommands` as the source of truth. In local development, the commands usually include `--channel linco-demo` and may also include `--allow-insecure-ws`.

A typical command shape looks like this for reference:

```bash
npm install -g linco-connect
linco-connect init --token "demo-codex-app:demo-codex-secret" --agent codex --channel linco-demo --account codex_1 --allow-insecure-ws
linco-connect start --daemon
```

### 5. Official H5 / WeChat Mini Program flow

If you are using a published H5 or WeChat Mini Program entry instead of local development, choose the entry that fits your device first:

**Hosted H5:** open [https://bridge-demo.lincotalk.com](https://bridge-demo.lincotalk.com).

**WeChat Mini Program:** scan the QR code below, or search `agent桥接器` in WeChat. The current mini-program flow uses **QR-code sign-in**.

<p align="center">
  <img src="../../docs/images/demo/mini-program-qr.png" alt="Linco Bridge WeChat Mini Program QR code" width="220" />
</p>

After entering either public entry:

1. Open **Bridge**.
2. Click **Import from Codex**.
3. Copy the generated `setupCommands`.
4. Run those commands in a local terminal on your own computer.
5. Return to the page and click `I have copied it, get connection status`.
6. Wait until the page confirms the connector is online.
7. Click `Enter Codex` to enter the chat page.
8. Use the folder icon in the top-right corner to choose a project, open an existing session, or create a new one.
9. Send a test message to confirm the full bridge flow is working.

Note: the experience QR code may expire. Please use the latest image in this repository or search `agent桥接器` in WeChat.

### 6. Mini Program build and local debugging

```bash
npm run dev:mp-weixin
npm run build:mp-weixin
```

## Common Scripts

| Command | Description |
| --- | --- |
| `npm run dev:h5` | H5 development server |
| `npm run build:h5` | H5 production build |
| `npm run dev:mp-weixin` | WeChat Mini Program development (loads `local.env`) |
| `npm run build:mp-weixin` | WeChat Mini Program production build (loads `prod.env`) |
| `npm run typecheck` | Type check |
| `npm run test` | Vitest |
| `npm run lint` | ESLint |
| `npm run check` | typecheck + lint + format + test |

## Environment Variables

Production builds (`build:h5` / `build:mp-weixin`) automatically load [`prod.env`](prod.env). No inline `VITE_*` flags are required.

> **Self-hosting:** `VITE_API_BASE_URL` in [`prod.env`](prod.env) is for the official hosted demo build only. Point it at your own server (or leave empty for same-origin `/api`). Do **not** use `https://bridge-demo.lincotalk.com` for third-party builds.

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | see `prod.env` | REST base URL; leave empty when API is same-origin |
| `VITE_USE_REMOTE_API` | `true` | Use in-memory mock when set to `false` |
| `VITE_AGENT_CHAT_SDK` | empty | Force AgentChat SDK to mock when set to `mock` |

Local dev does not load `prod.env`. Keep `VITE_API_BASE_URL` empty and use the dev proxy:

```text
/api → http://127.0.0.1:3300
```

Local WeChat Mini Program development uses [`local.env`](local.env), which defaults to `http://127.0.0.1:3300`:

```bash
# Terminal 1: start the local server
cd linco-bridge-platform/server
npm run start:dev

# Terminal 2: compile the mini program with local.env
cd linco-bridge-platform/web
npm run dev:mp-weixin
```

In WeChat DevTools, open **Details → Local Settings** and enable **Do not verify valid domain names**. For physical-device preview, replace the address in `local.env` with a LAN address that the device can reach, such as `http://192.168.x.x:3300`.

Published builds continue to use `prod.env` through `npm run build:mp-weixin`.

Pure UI mode without the backend:

```bash
VITE_USE_REMOTE_API=false npm run dev:h5
```

## Main Pages

Bottom tabs: `Messages`, `Assistants`, and `Bridge`

| Route | Page | Description |
| --- | --- | --- |
| `pages/messages/index` | Message list | All bridge chat sessions |
| `pages/agents/index` | Assistants | Connected Agent accounts and status |
| `pages/bridge/index` | Bridge home | Codex, Claude, Hermes, OpenClaw entry cards |
| `pages/bridge/import-local` | Import local Agent | Setup commands and connection checks |
| `pages/bridge/import-openclaw` | OpenClaw import | Context binding flow |
| `pages/chat/landing` | Agent landing page | History preview and first prompt |
| `pages/chat/index` | Chat detail | Streaming messages, attachments, workspace, settings |
| `pages/chat/history` | History page | Full Agent history |

## Project Structure

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

## SDK Flow

```text
BridgeSdk    → /api/agent-bridges/*
AgentChatSdk → /api/agent-chat/*
Session API  → /api/sessions/*
```

## Agent Capability Matrix

| Agent | Workspace selection | Context binding | Model and reasoning settings | Slash command completion |
| --- | --- | --- | --- | --- |
| Codex | Yes, switchable inside chat | No | Yes | Yes |
| Claude | Yes | No | Yes | Yes |
| Hermes | No | Import-time only | No | Yes |
| OpenClaw | No | Import-time only | No | Yes |

### Hermes and OpenClaw binding rules

- Context is selected only during import.
- A demo credential binds to one Profile or one Agent.
- The chat page does not support switching the bound Profile or Agent.

### Bridge settings for Codex and Claude

- The landing page and chat input can preload model and reasoning settings.
- Pending settings are submitted with the first message when a conversation starts.
- In chat, updated settings are persisted and applied through the connector.

Related files:

- `composables/useBridgeSettings.ts`
- `components/BridgeSettingsPickerSheet.vue`
- `utils/bridge-settings.ts`

### Slash commands (all bridge agents)

- The landing page and chat page preload commands through `/help`.
- The frontend first reads cached commands, then refreshes them from the connector.
- Typing `/` in the input shows suggestions from the cached command list.

Related files:

- `composables/useSlashCommands.ts`
- `composables/useSlashCommandInput.ts`
- `components/SlashCommandSuggestionPanel.vue`
- `bridge/slash-command.ts`
- `utils/slash-command-cache.ts`

## Core Composables

| Module | Responsibility |
| --- | --- |
| `useBridgeConnection` | Import-page connection checks, setup refresh, and one-time context binding |
| `useAgentLanding` | Landing-page data and conversation start |
| `useChatSession` | Chat loading, SSE stream, and stop generation |
| `useBridgeSettings` | Model and reasoning option preload plus picker state |
| `useSlashCommands` | `/help` preload, cache, and suggestion datasource |
| `useProjectPicker` | Codex and Claude workspace selection |
| `useAttachmentPicker` | File and image attachments |
| `useVoiceInput` | Voice input on supported H5 environments |

## Core Components

| Component | Description |
| --- | --- |
| `AgentLandingInput` | Landing-page input card with compact bridge toolbar |
| `ChatInputArea` | Chat-page input area |
| `ChatBubble` / `MessageContent` | Message rendering, including Markdown, code, and attachments |
| `BridgeSettingsPickerSheet` | Bottom sheet for model and reasoning settings |
| `SlashCommandSuggestionPanel` | Suggestion panel for `/` command input |
| `BridgeWorkspacePickerSheet` | Workspace and session picker |
| `BridgeContextPickerSheet` | Import-page context list for Hermes and OpenClaw |
| `AppOverlayHost` | Global mount host for sheets and overlays |

## Icon Assets

Committed icon assets are already available in the repository for normal evaluation.

Regenerate them only when needed:

```bash
node scripts/generate-icons.mjs
```

## Tests

```bash
npm test
```

## Notes

1. Start `server` before `web` for real API testing.
2. Restart the UniApp dev server after changing `pages.json` or adding pages.
3. Streaming chat depends on backend SSE.
4. If Agent capability behavior changes, update both this file and [`../server/README.md`](../server/README.md).

## H5 And WeChat Mini Program Differences

This project follows a **UniApp cross-platform approach**: shared business logic uses `uni.request` and `uni.storage`, while browser-only APIs are isolated in H5 branches or `platform-runtime`.

| Capability | H5 | WeChat Mini Program |
| --- | --- | --- |
| HTTP | Vite proxy + cookie session | Absolute URL + `X-Linco-Visitor-Session` header |
| Visitor ID / session | `localStorage` + cookie | `uni.setStorageSync` |
| Streaming chat | `fetch` + SSE | Blocking HTTP; the complete Agent response is displayed at once |
| Cancel generation | `AbortController` | Custom `CancelToken` |
| Scroll to bottom | `requestAnimationFrame` | `setTimeout` through conditional compilation |
| Open external links | `window.open` | Copy link or `uni.downloadFile` + `openDocument` |
| Voice input | Web Speech API | Not currently supported; requires the WeChat recording API |

**Important:** H5 and the mini program use **independent anonymous visitor sessions**, so bridge connections are not shared between them. Run the generated `linco-connect` commands and complete the connection check again in the mini program before its assistant and chat data become available.

Chat messages do **not** use a client-side WebSocket. WebSocket is used only between the local `linco-connect` connector and the platform. The mini program calls HTTP APIs through `uni.request`; plain-text messages use a blocking request by default and display the complete response after the local Agent finishes.

For local mini-program debugging:

1. Enable **Do not verify valid domain names** in WeChat DevTools.
2. Point `local.env` to a backend address that the mini program can reach.
3. Clear the mini-program cache and rebuild after code changes.
