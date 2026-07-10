# Protocol

[简体中文](zh-CN/protocol.md)

This page summarizes the public protocol boundary of Linco Bridge. It does not replace the connector protocol spec, but it should be enough for repository readers to understand how the bridge is structured and where custom integrations are allowed.

Detailed protocol material:

- [Connector Protocol](../linco-bridge-connect/docs/protocol.en-US.md)
- [Connector Architecture](../linco-bridge-connect/docs/architecture.en-US.md)
- [Platform README](../linco-bridge-platform/README.md)
- [Reference Web](reference-web.md)

## Project-Level Model

Linco Bridge does not define one single global external protocol. Instead, it has:

- a shared connector runtime;
- channel adapters that speak to different remote products;
- a reference platform channel (`linco-demo`);
- frontend SDKs and UI flows that consume bridge events.

In other words, external channel payloads belong to each adapter, while the shared connector layer works with normalized internal events.

## Channel Boundaries

| Channel | Purpose | Location |
| --- | --- | --- |
| `linco` | Official Linco product channel | `linco-bridge-connect/src/channel/linco/` |
| `linco-demo` | Open reference platform channel | `linco-bridge-connect/src/channel/lincoDemo/` + `linco-bridge-platform` |
| Custom channel | Third-party H5, mini program, app, web, or IM integration | Add `src/channel/<name>/` and register the adapter |

`linco` and `linco-demo` are independent channel keys. The demo currently uses a Linco-compatible protocol shape, but it can evolve independently in its own adapter.

## Core Message Families

At the project level, the most important protocol families are:

| Direction | Examples | Meaning |
| --- | --- | --- |
| Client → connector | `inbound_message`, `permission_response`, `danger_confirm`, `stop_turn` | User input and control signals sent to the local connector |
| Connector → client | `turn_start`, `stream_chunk`, `tool_call`, `permission_request`, `outbound_message`, `turn_end` | Agent progress, permission flow, files, and final completion |
| Structured local command results | `slash_command_result` | UI-friendly data for project lists, history, models, bindings, and similar features |

The bridge is event-driven. Remote frontends should treat `turn_end` as the final completion signal for one user turn.

## Streaming And Interaction Rules

The bridge is designed for richer Agent interactions than plain chat:

- `stream_chunk` supports progressive text output and final-answer replacement behavior.
- `thinking`, `agent_task`, and `agent_action` can represent intermediate reasoning or structured progress.
- `permission_request` and `danger_warning` require explicit user confirmation unless the current approval mode changes that behavior.
- file references are usually shown as clickable Markdown links whose targets are absolute local paths.

This is why Linco Bridge is better modeled as an Agent interaction bridge than a simple message forwarder.

## File Delivery Boundary

Generated files are not meant to be blindly uploaded as raw protocol payloads. The recommended flow is:

1. the Agent returns a Markdown file reference with an absolute local path;
2. the remote client renders that reference;
3. the client asks the connector to fetch the file only when the user requests it;
4. the connector validates path, file type, visibility, and size before returning content.

By default, hidden files such as `.env`, `.git/config`, and `.ssh/*` must stay blocked.

## Rules For Custom Integrations

If a third party wants its own product entry, the recommended path is:

- keep the shared connector runtime;
- add a new custom channel adapter;
- define product-specific payloads in that adapter;
- avoid changing the official `linco` channel behavior.

Secondary-development pull requests that change commands, payloads, event types, routing, or official-channel behavior must follow [Secondary Development Rules](secondary-development.md).

## What This Page Does Not Promise

This root protocol page does not promise:

- that every channel uses the exact same frontend payload shape;
- that the reference platform protocol is frozen forever;
- end-to-end encryption by default;
- production-grade compatibility guarantees for unpublished forks or modified clients.

For exact field-level schemas, compatibility notes, and adapter behavior, use the detailed protocol docs linked above.
