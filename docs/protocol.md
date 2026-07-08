# Protocol

[简体中文](zh-CN/protocol.md)

The root protocol page only defines the project boundary. Linco Bridge's public protocol is mainly represented by the connector channel adapters, reference-platform relay, and frontend SDKs.

For detailed protocol docs, refer to:

- [Connector Protocol](../linco-bridge-connect/docs/protocol.en-US.md)
- [Connector Architecture](../linco-bridge-connect/docs/architecture.en-US.md)
- [Platform README](../linco-bridge-platform/README.md)
- [Reference Web](reference-web.md)

## Project-Level Conventions

- `linco` is the official Linco product channel.
- `linco-demo` is the open reference platform channel for `linco-bridge-platform`.
- Third parties building their own H5, mini program, app, web, or IM entry should add their own channel adapter instead of modifying the official `linco` channel.
- Protocol payloads, event fields, and compatibility notes should follow the connector subproject docs and release notes.
- Secondary-development PRs that change commands, protocol payloads, event types, channel routing, or official-channel behavior must follow [Secondary Development Rules](secondary-development.md).
