# How It Works

[简体中文](zh-CN/how-it-works.md)

```text
Local agent
    ↕ local process, gateway, or session files
linco-connect on the user's computer
    ↕ authenticated WSS connection
Reference Platform or Linco Cloud
    ↕
Reference Web, Linco App, or a third-party client
```

The open-source reference platform maps to the `lincoDemo` channel in the connector plugin. It is a deployable example for teams that want a better Agent interaction surface than generic IM bridges. You can reuse the shared connector and Agent adapter layers while building your own H5 page, mini program, app, or other frontend channel.

## Responsibilities

- **Local agent:** Executes prompts and tools on the user's computer.
- **linco-connect:** Adapts the agent, maintains connectivity, and translates sessions and events.
- **Reference platform / server:** Authenticates devices, tracks connection state, and relays messages.
- **Client / channel frontend:** Displays sessions, sends messages, and presents permission requests.

## Boundaries

- The reference platform is a development reference, not a production self-hosted service by default.
- TLS/WSS protects transport but does not by itself provide end-to-end encryption.
- Synchronizing a session index does not mean uploading all historical messages.
- The final release must document data visibility, retention, and deletion.

