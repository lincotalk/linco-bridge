# How It Works

[简体中文](zh-CN/how-it-works.md)

```text
Local agent
    ↕ local process, gateway, or session files
linco-connect on the user's computer
    ↕ authenticated WSS connection
Minimal Server or Linco Cloud
    ↕
Reference Web, Linco App, or a third-party client
```

## Responsibilities

- **Local agent:** Executes prompts and tools on the user's computer.
- **linco-connect:** Adapts the agent, maintains connectivity, and translates sessions and events.
- **Server:** Authenticates devices, tracks connection state, and relays messages.
- **Client:** Displays sessions, sends messages, and presents permission requests.

## Boundaries

- Minimal Server is a development reference, not a production self-hosted service.
- TLS/WSS protects transport but does not by itself provide end-to-end encryption.
- Synchronizing a session index does not mean uploading all historical messages.
- The final release must document data visibility, retention, and deletion.

