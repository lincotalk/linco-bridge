# Supported Platforms

[简体中文](zh-CN/supported-platforms.md)

This page only documents project-level release scope. Exact Agent versions, Node.js compatibility, operating-system notes, and known limitations should follow the connector subproject README and release notes.

## Project-Level Scope

| Category | First-release scope | Detailed docs |
| --- | --- | --- |
| Agents | Codex CLI, Claude Code, Hermes, OpenClaw | [Connector README](../linco-bridge-connect/README.en-US.md) |
| Official channel | `linco` | [Connector configuration](../linco-bridge-connect/README.en-US.md#configuration) |
| Open reference channel | `linco-demo` | [Platform README](../linco-bridge-platform/README.md) |
| Custom channels | Extensible by adding channel adapters | [Connector architecture](../linco-bridge-connect/docs/architecture.en-US.md) |

## Publishing Rule

- Keep the root README, subproject READMEs, release notes, and compatibility statements aligned.
- Publish exact tested versions, operating systems, and known limitations in releases once validation is complete.
- If a specific Agent, Node.js version, or operating system is shipped with limitations, list it in release notes and troubleshooting docs.
