# Linco Bridge

[简体中文](README.zh-CN.md)

> An open bridge layer for connecting AI agent tools running on a personal computer to Web, H5, mini program, app, IM, or other clients.

**Project status:** Open Source Alpha. Interfaces, compatibility, and documentation may still change. The first open-source release focuses on a working local connector, a deployable reference platform channel, and bridge validation for Codex CLI, Claude Code, Hermes, and OpenClaw.

## What It Is

Local AI agent tools are powerful, but their sessions, tool execution, and generated files usually stay on one computer. Many bridge projects connect these tools to existing collaboration platforms such as Feishu, WeChat, DingTalk, or similar IM products. That lowers integration cost, but display and interaction are constrained by the host platform: tool progress, permission confirmations, generated files, long-running sessions, multi-agent state, and session recovery are hard to present comfortably.

Linco Bridge is not meant to force every workflow into one IM product. It provides an open reference path:

- use the local connector plugin to bridge PC-based Agent CLIs;
- deploy the open reference platform to try the `linco-demo` channel quickly;
- use the official Linco channel for the full official product experience;
- build your own H5 page, mini program, app, web, or IM entry on top of the public protocol, SDKs, and channel adapter mechanism.

## Repository Scope

This repository contains two runnable subprojects plus project-level documentation:

- `linco-bridge-connect`: the local connector / plugin project. It runs on the user's computer, connects to local Agent CLIs, and relays messages, permission requests, attachments, and generated files to a remote channel;
- `linco-bridge-platform`: the open reference platform channel. It includes a NestJS backend and UniApp frontend for quickly self-hosting the `linco-demo` flow, and can be used as a reference for custom H5, mini program, or app development;
- `docs/`: project-level documentation for setup, architecture, protocol, security, support scope, and troubleshooting.

This repository does **not** include the full Linco App product or official hosted cloud-service code. The official Linco channel is a product experience entry; the open `linco-demo` channel is a deployable and customizable reference implementation.

## How It Works

```text
Local Agent CLI
    ↕ local process, gateway, or session files
linco-bridge-connect on the user's computer
    ↕ authenticated WebSocket bridge connection
Official Linco channel, open Reference Platform, or compatible backend
    ↕
Linco App, Reference Web, custom H5/mini program/app/IM client
```

`linco-bridge-connect` adapts the local agent and relays sessions, messages, permission requests, attachments, and generated files to compatible products. `linco-bridge-platform` provides a locally deployable backend and H5 experience for validating the full flow and for building a better custom interaction model.

## Recommended Paths

| Path | Best for | Notes |
| --- | --- | --- |
| Official Linco channel (`linco`) | Users who want the official product flow | Uses the default channel and official credentials. No platform deployment is required. |
| Open reference platform (`linco-demo`) | Teams that want quick self-hosting, bridge validation, or implementation study | Start the `linco-bridge-platform` server + web app, then connect the local Agent with the connector. |
| Custom channel adapter | Product or engineering teams building a better interaction experience | Reuse the connector and Agent adapter layer, then add your own H5, mini program, app, web, or IM channel. |

## Quick Start

### Option 1: Official Channel

Install the local connector:

```bash
npm install -g linco-connect
```

Initialize it with credentials issued for the official channel:

```bash
linco-connect init \
  --token "<app-id>:<app-secret>" \
  --agent codex
```

Start the connector:

```bash
linco-connect start --daemon
```

Then open a compatible client, confirm the device is online, enter a session, and send a test message.

### Option 2: Open Reference Platform

Start the reference backend and H5 frontend:

```bash
cd linco-bridge-platform/server
npm install
npm run start:dev

cd ../web
npm install
node scripts/generate-icons.mjs
npm run dev:h5
```

Open the bridge page in the H5 frontend and copy the generated `linco-connect` setup command. A manual command usually looks like this:

```bash
linco-connect init \
  --token "demo-codex-app:demo-codex-secret" \
  --agent codex \
  --channel linco-demo \
  --account codex_1 \
  --allow-insecure-ws

linco-connect start --daemon
```

For the detailed flow, see [Quick Start](docs/quick-start.md) and the [platform README](linco-bridge-platform/README.md).

## Supported Agents

| Agent | First-release status | Verified version in subproject docs |
| --- | --- | --- |
| Codex CLI | Supported | `codex-cli 0.142.5` |
| Claude Code | Supported | `2.1.198 (Claude Code)` |
| Hermes | Supported | `Hermes Agent v0.13.0 (2026.5.7)` |
| OpenClaw | Supported | `OpenClaw 2026.5.18 (50a2481)` |

Exact compatibility should follow release notes and each subproject README.

## SDKs and Extension Points

- `linco-bridge-connect/src/package/connector`: reusable connector SDK for authenticated bridge WebSocket connectivity;
- `linco-bridge-connect/src/package/protocol`: connector-side message, file, and channel normalization helpers;
- `linco-bridge-platform/web/src/bridge/sdk`: Bridge SDK / AgentChat SDK reference implementation for the reference platform REST APIs and bridge flow;
- `linco-bridge-connect/src/channel/`: channel adapter extension point. `linco` is the official channel, `linco-demo` is the open reference platform channel, and third parties should add and register their own channel directory.

## Project Boundaries

| Capability | Included in this repository |
| --- | --- |
| Local connector plugin | Yes |
| Open reference platform channel | Yes |
| Reference Web / H5 experience | Yes |
| Full official Linco App product | No |
| Official hosted cloud-service code | No |
| Production self-hosting operations guide | No. The current scope is development validation and secondary-development reference. |

## Security and Privacy

- Never commit App Secrets, tokens, or private keys, and do not write them to logs.
- Local `linco-demo` uses `ws://127.0.0.1:3300` for local development validation only. Public deployments should configure TLS/WSS plus their own authentication, storage, and audit policies.
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
- [Connector README](linco-bridge-connect/README.en-US.md)
- [Platform README](linco-bridge-platform/README.md)
- [Support Boundary](SUPPORT.md)
- [Contributing](CONTRIBUTING.md)

## Contributing

Issues, discussions, and pull requests are welcome. For contribution expectations and reporting guidance, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This project is licensed under the [MIT License](LICENSE).

The MIT license applies to the code and included documentation in this repository. It does not grant rights to use the Linco name, logo, or other brand assets outside normal nominative reference.
