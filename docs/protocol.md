# Protocol

[简体中文](zh-CN/protocol.md)

This document describes the public contract shared by the CLI, server, Reference Web, and compatible clients. It must be completed from the audited implementation before release.

## Required sections

1. Protocol version and compatibility negotiation.
2. Device registration and credential validation.
3. Heartbeat and online/offline state.
4. Agent, project, profile, and session identifiers.
5. Session-index synchronization and message pagination.
6. Message, tool, permission, file, and error events.
7. Reconnection, deduplication, ordering, and timeout behavior.
8. Credential expiration, revocation, refresh, and occupied-credential handling.

Do not publish undocumented production endpoints, signing secrets, or internal risk-control rules.

