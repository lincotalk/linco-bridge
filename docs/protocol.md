# Protocol

[简体中文](zh-CN/protocol.md)

This document is the public protocol overview for the first open-source release. It describes the shared bridge concepts and the minimum message contract exposed by the connector, reference platform, and compatible clients.

## Scope

- Transport: authenticated WebSocket between connector and compatible backend.
- Participants: local agent connector, compatible backend, and compatible client.
- Purpose: relay presence, inbound user messages, assistant output, tool/permission events, and bridge state needed for a client bridge experience.

This overview does not document internal hosted-service endpoints, signing secrets, or deployment-specific risk-control rules.

## Authentication

- The connector connects to a bridge WebSocket endpoint.
- The effective credential is passed as a `token` query parameter in the form `<appId>:<appSecret>`.
- Compatible backends should validate the token before accepting the bridge session.

## Session and selector concepts

- `agentType`: selected local agent type such as `codex`, `claude`, `hermes`, or `openclaw`.
- `sessionKey`: bridge-visible session identifier used to correlate inbound and outbound turns.
- `streamId`: turn-level stream identifier used to collect chunks and finalize a reply.
- `accountId`: configured credential/account identity for the selected bridge connection.
- `profile` / `agentId`: selector required by some local tools, such as Hermes profiles or OpenClaw agents.

## Core message flow

1. Connector authenticates to the backend bridge WebSocket.
2. Backend acknowledges the bridge connection and tracks device presence.
3. Client or backend sends an `inbound_message` frame to the connector.
4. Connector forwards the turn to the selected local agent.
5. Connector may emit `turn_start`, progress events, streaming chunks, and final reply frames.
6. Optional permission, danger-confirmation, or turn-stop frames may interrupt the turn before completion.

## Common frame types

| Frame type | Direction | Purpose |
| --- | --- | --- |
| `hello` | backend -> connector | Confirms bridge connection and selected bridge type |
| `ping` / `pong` | both directions | Heartbeat and liveness |
| `presence_event` | connector -> backend | Announces online/offline state and optional device metadata |
| `inbound_message` | backend/client flow -> connector | Delivers a user message to the selected local agent |
| `permission_response` | backend/client flow -> connector | Resolves a pending tool-permission request |
| `danger_confirm` | backend/client flow -> connector | Resolves a dangerous-operation confirmation request |
| `stop_turn` | backend/client flow -> connector | Cancels the current in-progress turn |
| `turn_start` | connector -> backend/client flow | Signals that the connector has started processing a turn |
| `stream_chunk` | connector -> backend/client flow | Sends partial assistant output for a turn |
| `permission_request` | connector -> backend/client flow | Requests user confirmation for a tool or permission gate |
| `danger_warning` | connector -> backend/client flow | Requests explicit confirmation for a dangerous operation |
| `outbound_message` | connector -> backend/client flow | Sends a complete assistant reply or file-delivery message |
| `slash_command_result` | connector -> backend/client flow | Returns structured local-command results for UI rendering |
| `agent_session` | connector -> backend/client flow | Announces that a native agent session has been established or resumed |
| `turn_end` | connector -> backend/client flow | Marks turn completion, cancellation, or failure |

## Compatibility note

The exact event payloads can evolve with release notes. When a breaking protocol change is introduced, the repository documentation and release notes should be updated together.
