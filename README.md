# Linco Connect

[简体中文](README.zh-CN.md)

> Connect local AI tools to web, mobile, and IM products through an open bridge layer.

**Project status:** Open Source Alpha. APIs, compatibility, and documentation may still change. Stable, Experimental, and Planned capabilities are documented separately.

## Why Linco Connect

Local AI tools are powerful, but their conversations usually stay on one computer. Many bridge projects connect these tools to existing collaboration platforms such as Feishu, WeChat, DingTalk, or similar IM products. That approach lowers the integration cost, but the display and interaction model is constrained by the host platform. Tool progress, permission confirmations, generated files, long-running sessions, and multi-Agent state are often hard to present comfortably.

Linco Connect provides an open bridge layer so local Agents can be used from other product surfaces. The repository also includes a reference platform project. That platform corresponds to the `lincoDemo` channel in the connector plugin and demonstrates a dedicated Agent interaction surface. You can deploy the reference implementation first to experience the workflow, then build your own H5 page, mini program, app, or other frontend channel and implement a matching channel adapter for a more personalized and comfortable experience.

- Use the reference platform to verify the full bridge flow.
- Integrate the protocol and adapters into your own web, app, mini program, or IM product.
- Use Linco App or the official Linco channel when you want the full official product experience.

## Supported Tools

| Tool | Status | Notes |
| --- | --- | --- |
| Codex | Stable target | Tested versions and operating systems must be filled before release. |
| Claude Code | Stable target | Tested versions and operating systems must be filled before release. |
| OpenClaw | Experimental / Planned | Released only after basic compatibility validation. |
| Hermes | Experimental / Planned | Released only after basic compatibility validation. |

## Quick Start

> Verify these commands against the final release before publication.

```bash
npm install -g linco-connect

linco-connect init \
  --token "<app-id>:<app-secret>" \
  --agent codex

linco-connect start --daemon
```

Continue with [Quick Start](docs/quick-start.md) to create credentials, check the connection, enter a session, and send a test message.

## How It Works

```text
Codex / Claude Code / other local Agents
                    ↕
              linco-connect
                    ↕
      Reference Platform or Linco Cloud
                    ↕
   Reference Web / Linco App / third-party clients
```

`linco-connect` runs on the user's computer and connects local Agents to compatible servers and clients. Public documentation must explain which metadata, session indexes, messages, files, and logs leave the computer, and how they are retained or deleted.

## Usage Paths

| Path | Users | Availability |
| --- | --- | --- |
| Reference Platform / Reference Web | Developers who want to verify the bridge flow or build a custom experience | Included with the open-source version |
| Custom channel adapter | Teams building their own H5, mini program, app, or IM client | Included with the open-source protocol and connector |
| Linco App / official Linco channel | Users who want the full official product experience | Official product |
| Protocol integration | Teams building their own clients or servers | Included with the open-source version |
| SDK | Integration teams that need higher-level wrappers | Planned unless explicitly marked Released |
| Self-hosting | Teams that need independent deployment | Initial release focuses on minimal development verification; production references are tracked in the roadmap |
| Official Web / Mini Program | Users who do not want to deploy anything | Planned; no inactive links before launch |

## Security And Privacy

- Do not commit credentials or write them to logs.
- TLS / WSS transport encryption is not the same as end-to-end encryption.
- Synchronizing a session index is not the same as uploading full message history.
- Read [Security and Privacy](docs/security-and-privacy.md) before connecting real data.
- Report vulnerabilities privately through [SECURITY.md](SECURITY.md).

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

## Team

Linco is built by product creators and AI-native developers who care about making AI useful in real software, communication, and collaboration workflows. We welcome developers, product designers, independent builders, and teams exploring Agent-powered products to join discussions, issues, and pull requests.

## License

The final license name and link will be added after legal and patent review. The open-source license does not automatically grant rights to the Linco name or logo; brand rules will be published separately after approval.
