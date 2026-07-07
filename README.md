# Linco Bridge

[简体中文](README.zh-CN.md)

> An open bridge layer for connecting local AI agent tools to web, mobile, and IM clients.

**Project status:** Open Source Alpha. Interfaces, compatibility, and documentation may still change, but the first open-source release targets all four supported agents and a usable SDK surface.

## What It Is

Local AI agent tools are powerful, but their sessions usually stay on one computer. Many bridge projects connect these tools to existing collaboration platforms such as Feishu, WeChat, DingTalk, or similar IM products. That approach lowers integration cost, but display and interaction are constrained by the host platform. Tool progress, permission confirmations, generated files, long-running sessions, and multi-agent state are often hard to present comfortably.

Linco Bridge helps teams expose local AI agent tools beyond a single desktop. It provides an open connector, a reference platform, and reusable SDK/protocol layers so you can:

- verify the full bridge flow with the reference platform and reference web client;
- connect local agents to your own web, app, mini program, or IM product;
- deploy the reference platform (mapped to the `lincoDemo` channel in the connector), then build your own H5 page, mini program, app, or other frontend channel with a matching channel adapter;
- build compatible integrations on top of the public protocol and SDK surface.

## Repository Scope

This repository currently contains:

- `linco-bridge-connect`: the local connector CLI that runs on the user's computer and bridges agent sessions to compatible clients and servers;
- `linco-bridge-platform`: a self-hosted demo/reference platform with a NestJS backend and UniApp frontend;
- `docs/`: project-level documentation for setup, architecture, protocol, security, and troubleshooting.

This repository does **not** include the full Linco App product or hosted cloud services.

## How It Works

```text
Local agent CLI
    ↕ local process, gateway, or session files
linco-bridge-connect on the user's computer
    ↕ authenticated bridge connection
Reference platform, compatible backend, or Linco Cloud
    ↕
Reference web, Linco App, or a third-party client
```

`linco-bridge-connect` runs on the user's computer, adapts a local agent, and relays sessions, messages, permissions, attachments, and generated files to compatible products.

## Typical Use Cases

- Developers who want to validate a complete local-agent-to-client bridge flow.
- Product teams that want to integrate local AI tools into their own app, web, or IM experience.
- Engineering teams that want a reference implementation before building their own bridge-compatible stack.

## Quick Start

Install the local connector:

```bash
npm install -g linco-connect
```

Initialize a device with an issued credential:

```bash
linco-connect init \
  --token "<app-id>:<app-secret>" \
  --agent codex \
  --device-name codex1
```

Start the connector:

```bash
linco-connect start --daemon
```

Then open a compatible client, confirm the device is online, enter a session, and send a short test message.

For the detailed flow, see [Quick Start](docs/quick-start.md).

## Supported Agents

| Agent | Status | Notes |
| --- | --- | --- |
| Codex CLI | Supported in first release | Connector, reference platform, and bridge flow are included in the first open-source release. |
| Claude Code | Supported in first release | Connector, reference platform, and bridge flow are included in the first open-source release. |
| Hermes | Supported in first release | Connector, profile binding flow, and reference platform support are included in the first open-source release. |
| OpenClaw | Supported in first release | Connector, agent binding flow, and reference platform support are included in the first open-source release. |

## SDK Surface

The first open-source release includes two SDK layers with different goals:

- `packages/connector-sdk` in `linco-bridge-connect`: a reusable connector client for authenticated bridge WebSocket connectivity;
- `linco-bridge-platform/web/src/bridge/sdk`: usable Bridge SDK and AgentChat SDK reference implementations for web integration against the reference platform REST APIs.

The connector SDK is a reusable package surface. The web Bridge/AgentChat SDK is currently positioned as a reference implementation for integration teams building on the open protocol and demo platform.

## Project Boundaries

| Path | Intended user | Availability |
| --- | --- | --- |
| Reference Platform / Reference Web | Developers validating the bridge flow or building a custom experience | Included with the open-source release |
| Custom channel adapter | Teams building their own H5, mini program, app, or IM client | Included with the open-source protocol and connector |
| Linco App / official Linco channel | Users who want the full product experience | Official product |
| Protocol integration | Teams building their own client or server | Included with the open-source release |
| Connector SDK | Teams that want reusable bridge client connectivity | Included with the open-source release |
| Bridge SDK / AgentChat SDK | Teams integrating with the reference platform or adapting the flow to their own client | Included as a usable reference implementation |
| Self-hosting | Teams that need their own deployment | Initial release is for reference/dev validation, not production guidance |

## Security and Privacy

- Never commit credentials or write secrets to logs.
- TLS/WSS transport encryption does not by itself mean end-to-end encryption.
- Session index synchronization does not necessarily mean full message-history upload.
- Review [Security and Privacy](docs/security-and-privacy.md) before connecting real data.
- Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## Documentation

- [Quick Start](docs/quick-start.md)
- [How It Works](docs/how-it-works.md)
- [CLI Reference](docs/cli.md)
- [Public Protocol](docs/protocol.md)
- [Reference Web](docs/reference-web.md)
- [Supported Platforms](docs/supported-platforms.md)
- [Security and Privacy](docs/security-and-privacy.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Support Boundary](SUPPORT.md)
- [Contributing](CONTRIBUTING.md)

## Contributing

Issues, discussions, and pull requests are welcome. For contribution expectations and reporting guidance, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This project is licensed under the [MIT License](LICENSE).

The MIT license applies to the code and included documentation in this repository. It does not grant rights to use the Linco name, logo, or other brand assets outside normal nominative reference.
