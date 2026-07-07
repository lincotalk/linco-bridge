# How It Works

[简体中文](zh-CN/how-it-works.md)

```text
Local Agent CLI
    ↕ local process, gateway, or session files
linco-connect on the user's computer
    ↕ authenticated WebSocket connection
Official Linco channel, open Reference Platform, or compatible backend
    ↕
Linco App, Reference Web, custom H5/mini program/app/IM client
```

The repository has two runnable subprojects:

- `linco-bridge-connect` is the PC-side connector plugin. It adapts local Agents, maintains remote connections, and translates sessions and events.
- `linco-bridge-platform` is the open reference platform channel. It includes a backend relay and H5 frontend, and maps to the connector's `linco-demo` channel.

The official `linco` channel is for the official product experience. The open `linco-demo` channel is for quick deployment, bridge validation, and secondary development. Teams can also add their own channel adapter to connect the same local connector to a custom H5 page, mini program, app, web, or IM product.

## Responsibilities

- **Local agent:** Executes prompts, tools, and file operations on the user's computer.
- **linco-connect:** Adapts Agent CLIs, maintains channel/account/agent connections, and handles permission confirmations, attachments, and file delivery.
- **Reference Platform / Server:** Validates demo credentials, tracks connection state, and relays client messages and connector events.
- **Client / channel frontend:** Displays sessions, sends messages, and presents streaming output and permission requests.

## Channel Boundaries

| Channel | Location | Purpose |
| --- | --- | --- |
| `linco` | `linco-bridge-connect/src/channel/linco/` | Official Linco product channel. |
| `linco-demo` | `linco-bridge-connect/src/channel/lincoDemo/` + `linco-bridge-platform` | Open reference platform channel. Defaults to local `ws://127.0.0.1:3300/bridge/ws/<agent>`. |
| Custom channel | Add and register `src/channel/<name>/` | For your own H5, mini program, app, web, or IM product. |

## Boundaries

- The Reference Platform is for development, integration validation, and secondary-development reference, not production hosting guidance.
- Local `linco-demo` uses `ws://` by default and is only suitable for local development validation. Public deployments should use TLS/WSS.
- TLS/WSS protects transport but does not by itself provide end-to-end encryption.
- Synchronizing a session index does not mean uploading all historical messages.
- Data visibility, retention, and deletion depend on the connector, backend deployment, and client flow in use; review the security and privacy documentation before connecting real data.

## Detailed Docs

- [Connector architecture](../linco-bridge-connect/docs/architecture.en-US.md)
- [Connector protocol](../linco-bridge-connect/docs/protocol.en-US.md)
- [Platform README](../linco-bridge-platform/README.md)
