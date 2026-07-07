# How It Works

[简体中文](zh-CN/how-it-works.md)

```text
Local agent
    ↕ local process, gateway, or session files
linco-connect on the user's computer
    ↕ authenticated WSS connection
Reference platform, compatible backend, or Linco Cloud
    ↕
Reference Web, Linco App, or a third-party client
```

## Responsibilities

- **Local agent:** Executes prompts and tools on the user's computer.
- **linco-connect:** Adapts the agent, maintains connectivity, and translates sessions and events.
- **Server:** Authenticates devices, tracks connection state, and relays messages.
- **Client:** Displays sessions, sends messages, and presents permission requests.

## Boundaries

- The reference platform is a development and integration reference, not production hosting guidance.
- TLS/WSS protects transport but does not by itself provide end-to-end encryption.
- Synchronizing a session index does not mean uploading all historical messages.
- Data visibility, retention, and deletion depend on the connector, backend deployment, and client flow in use; review the security and privacy documentation before connecting real data.
