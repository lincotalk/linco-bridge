# Linco Connect Architecture

This document is for contributors who need to read, debug, or extend `linco-bridge-connect`.

## Runtime Role

Linco Connect is a local Agent connector. It converts remote IM messages into inputs for local Agent CLIs or Agent Gateways, then converts Agent replies, streaming output, tool calls, permission confirmations, and file references back into events that the remote IM can consume.

It is not an authentication center or a hosted multi-tenant service. Credentials are stored in the local configuration, and remote connections are created from the configured channel/account/agent combination.

From an open-source perspective, Linco Connect is not limited to the official Linco IM. Many bridge projects rely on existing platforms such as Feishu, WeChat, DingTalk, or similar IM products, but those platforms are not always well suited to Agent tool progress, permission confirmations, generated files, and long-running sessions. The companion open-source platform project maps to the `linco-demo` channel and acts as a deployable reference implementation. Third parties can add channel adapters for their own H5 pages, mini programs, apps, or other frontends while reusing the shared connector and Agent adapter layers.

## Main Directories

| Directory | Responsibility |
| --- | --- |
| `bin/` | npm CLI entry point. Exposes the `linco-connect` command. |
| `src/cli/` | CLI entry and local operations. `index.js` remains the command dispatcher; init, accounts, ws-prefix, daemon, doctor, and help are split by responsibility. |
| `src/service/` | Local service startup, shutdown, lifecycle orchestration, control channel, and runtime config reload. |
| `src/local/` | Local test page, local access auth, and local WebSocket integration. |
| `src/update/` | npm self-update checks, status records, and background update scheduling. |
| `src/config/` | Defaults, environment variables, user config IO, command resolution, and account config handling. |
| `src/channel/` | Concrete channel adapters. Currently includes the `linco/` and `lincoDemo/` directories, which map to the `linco` and `linco-demo` channel keys; shared connection, registry, and presence logic live in `src/core/`. |
| `src/agent/` | Agent adapters for Claude, Codex, Hermes, and OpenClaw. Each Agent type has its own directory and `index.js` provider entry. |
| `src/runtime/` | Agent runtime environment, process runner, Claude history, and project-path helpers. |
| `src/command/` | Local slash commands handled inside remote sessions. |
| `src/core/` | Shared session, protocol sending, logging, permission state, file reference, and streaming-buffer logic. |
| `src/attachment/` | Inbound attachment persistence, validation, and image handling. |
| `src/gateway/` | Hermes/OpenClaw Gateway startup, health checks, and clients. |
| `src/package/protocol/` | Reusable message, file, and channel normalization helpers. |
| `src/package/connector/` | Remote bridge WebSocket client, authenticated URL building, reconnect, heartbeat, and message queue. |
| `public/` | Local test page. |
| `test/` | Node.js native test-runner tests. |

## Data Flow

1. A remote channel sends its external protocol message over WebSocket, such as Linco `inbound_message`.
2. `src/core/channelConnector.js` resolves the adapter from the configured `channel`, then finds or creates the local session by channel/account/agent/sessionKey.
3. The channel adapter converts the external message into internal connector input and keeps required routing metadata. `linco` and `linco-demo` are independent adapters; `linco-demo` currently reuses the Linco-compatible protocol.
4. `src/runtime/agentRunner.js` calls the Agent adapter based on `session.agentType`.
5. The Agent adapter starts a local CLI or calls a Gateway and converts output into internal events such as `assistant_chunk`, `tool_call`, `permission_request`, and `turn_end`.
6. The channel adapter converts internal events into external channel events such as Linco `stream_chunk`, `outbound_message`, `slash_command_result`, and `turn_end`.
7. The remote channel updates the UI by `streamId`, `sessionKey`, `messageId`, and related fields.

## Module Boundaries

`src/core` should not depend on concrete Agents. It provides session, logging, permission, file, and common protocol capabilities.

`src/agent` may depend on `src/core` and `src/runtime`, but it should not handle remote IM channel/account connection details directly.

`src/channel` should only contain concrete channel adapters. Shared connection flow belongs in `src/core/channelConnector.js`, channel registration in `src/core/channelRegistry.js`, and presence construction in `src/core/channelPresence.js`; connector config signatures, remote metadata, and Agent account identity resolution live in `src/core/channelConnectorConfig.js`, `src/core/channelConnectorMeta.js`, and `src/core/channelConnectorIdentity.js`. The official Linco IM protocol lives in `src/channel/linco/`; the open-source H5 demo channel lives in `src/channel/lincoDemo/`. Third-party channels should add `src/channel/<channel>/` and register through `registerChannelAdapter()` instead of modifying the official `linco` channel.

`src/local` only handles the local test page and local WebSocket access. The built-in Web UI is disabled by default and is only enabled explicitly with local debugging options such as `linco-connect start --local-im` / `--mock-im`. It is intended for local development, self-testing, and protocol debugging, not as a production Web service, and should not be exposed to the public internet.

`src/package/protocol` and `src/package/connector` should stay lightweight and reusable. They must not depend back on business modules under `src/`.

## Agent Prompt

`src/core/agentPrompt.js` maintains the Agent-visible Linco Connect bridge identity and common delivery rules. The prompt should tell the Agent that it is connected to Linco IM through Linco Connect and that normal text replies are automatically sent to the user.

Claude injects the prompt through `--append-system-prompt`. Hermes injects it through Gateway `instructions`. Codex and OpenClaw keep the existing protocol field shape and append the bridge prompt in the input layer.

The Agent-visible file delivery prompt should only require Markdown absolute path links, such as `[filename.ext](absolute-local-path)`. The internal file-fetch command should not be exposed in the Agent prompt.

## Session Identifiers

Linco Connect handles at least three identifier types:

| Identifier | Source | Purpose |
| --- | --- | --- |
| `sessionKey` | Remote IM or connector | Bridge-layer session routing. |
| `agentSessionId` | Agent CLI/Gateway | Resume native Claude/Codex/Hermes/OpenClaw sessions. |
| `messageId` / `streamId` | Remote IM or connector | Bind a user message, streaming reply, and `turn_end`. |

Do not concatenate `_lincoMeta` into user text or Agent prompts.
