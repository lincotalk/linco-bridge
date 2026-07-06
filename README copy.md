# Linco Connect

[简体中文](README.zh-CN.md)

> Connect local AI tools to web, mobile, and messaging products through an open bridge.

**Project status:** Open Source Alpha. Interfaces, compatibility, and documentation may change. Stable, Experimental, and Planned capabilities are listed separately.

## Why Linco Connect

Local AI tools are powerful, but their sessions usually remain on one computer. Linco Connect provides a controlled connection layer for accessing those tools from other product surfaces.

- Use the Reference Web client to verify the complete connection flow.
- Integrate the protocol and adapters into your own web, app, or messaging product.
- Use the Linco App for a more complete device, session, synchronization, and messaging experience.

## Supported tools

| Tool | Status | Notes |
| --- | --- | --- |
| Codex | Stable target | Final tested versions and operating systems must be added before release. |
| Claude Code | Stable target | Final tested versions and operating systems must be added before release. |
| OpenClaw | Experimental / Planned | Publish only after basic compatibility verification. |
| Hermes | Experimental / Planned | Publish only after basic compatibility verification. |

## Quick start

> The commands below must be verified against the final release before this draft is published.

```bash
npm install -g linco-connect

linco-connect init \
  --token "<app-id>:<app-secret>" \
  --agent codex \
  --device-name codex1

linco-connect start --daemon
```

Continue with the [Quick Start](docs/quick-start.md) to create credentials, verify the connection, open a session, and send a test message.

## How it works

```text
Codex / Claude Code / other local agents
                    ↕
              linco-connect
                    ↕
        Minimal Server or Linco Cloud
                    ↕
       Reference Web / Linco App / your app
```

`linco-connect` runs on the user's computer. It connects the local agent to a compatible server and client. The public documentation explains which metadata, session indexes, messages, files, and logs leave the computer and how they are retained.

## Ways to use

| Path | Audience | Availability |
| --- | --- | --- |
| Reference Web | Developers verifying the bridge | Included in the open-source release |
| Linco App | Users who want the complete product experience | Official product |
| Protocol integration | Teams building their own client | Included in the open-source release |
| SDK | Teams that want a higher-level integration | Available only if marked released; otherwise Planned |
| Self-hosting | Teams that require independent deployment | Minimal development example first; production reference deployment follows the roadmap |
| Official hosted web / mini program | Users who do not want to deploy | Planned; show a live link only after launch |

## Security and privacy

- Credentials must never be committed to a repository or included in logs.
- Transport encryption such as TLS/WSS is not the same as end-to-end encryption.
- Session indexes are not the same as complete message history.
- Read [Security and privacy](docs/security-and-privacy.md) before connecting real data.
- Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## Documentation

- [Quick Start](docs/quick-start.md)
- [How it works](docs/how-it-works.md)
- [CLI reference](docs/cli.md)
- [Protocol](docs/protocol.md)
- [Reference Web](docs/reference-web.md)
- [Supported platforms](docs/supported-platforms.md)
- [Security and privacy](docs/security-and-privacy.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Support](SUPPORT.md)
- [Contributing](CONTRIBUTING.md)

## Who we are

Linco brings together product builders and AI-native developers who are deeply curious about AI and eager to turn ideas into working products. We explore how AI is changing software, communication, and collaboration, then try to make those changes useful in everyday work.

Whether you are an experienced engineer, a product designer, an independent maker, an AI-native programmer learning by building, or a team exploring a product, company, or startup idea, you are welcome in the Linco product community. Discuss Linco products, AI agents, open-source integrations, workflows, prototypes, and new ventures, or help improve Linco Connect through issues, discussions, and pull requests.

## License

The final license name and link must be inserted here after legal and patent review. The open-source license does not automatically grant rights to Linco names or logos; the final brand terms will be published separately when approved.
