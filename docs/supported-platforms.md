# Supported Platforms

[简体中文](zh-CN/supported-platforms.md)

This page summarizes the first-release compatibility scope of the repository. It is not a replacement for detailed subproject release notes, but it should help evaluators quickly understand what is officially in scope today.

Detailed references:

- [Connector README](../linco-bridge-connect/README.en-US.md)
- [Platform README](../linco-bridge-platform/README.md)
- [Troubleshooting](troubleshooting.md)
- [CHANGELOG](../CHANGELOG.md)

## Runtime Requirements

| Item | Current guidance |
| --- | --- |
| Node.js | Node.js 20+; Node.js 22 LTS recommended |
| Local connector package | `linco-connect` |
| Supported local Agents | Codex CLI, Claude Code, Hermes, OpenClaw |
| Reference platform backend | `linco-bridge-platform/server` |
| Reference platform frontend | `linco-bridge-platform/web` |

## Verified Agent Versions

The current documented verification set is:

| Agent | Verified version | Notes |
| --- | --- | --- |
| Codex CLI | `codex-cli 0.142.5` | Uses app-server mode by default |
| Claude Code | `2.1.198 (Claude Code)` | Uses stream-json and stdio permission flow |
| Hermes | `Hermes Agent v0.13.0 (2026.5.7)` | Supports profile listing and binding |
| OpenClaw | `OpenClaw 2026.5.18 (50a2481)` | Supports agent listing and binding |

## Project-Level Scope

| Category | First-release scope | Detailed docs |
| --- | --- | --- |
| Agents | Codex CLI, Claude Code, Hermes, OpenClaw | [Connector README](../linco-bridge-connect/README.en-US.md) |
| Official channel | `linco` | [Connector configuration](../linco-bridge-connect/README.en-US.md#configuration) |
| Open reference channel | `linco-demo` | [Platform README](../linco-bridge-platform/README.md) |
| Custom channels | Extensible by adding channel adapters | [Connector architecture](../linco-bridge-connect/docs/architecture.en-US.md) |

## Frontend Forms Covered By This Repository

The repository currently supports or references:

- official Linco product flow through the `linco` channel;
- local or hosted H5 reference flow through `linco-demo`;
- WeChat Mini Program build output from the reference web project;
- custom H5, mini program, app, web, or IM entries built on top of a new channel adapter.

The repository does **not** ship a full production control plane for every frontend form.

## Known Scope Limits

- The open-source reference platform is for evaluation, onboarding, and secondary-development reference rather than turnkey production hosting.
- Hosted demo behavior may intentionally trade isolation or persistence for lower setup cost.
- Compatibility should be treated as versioned, not eternal. If an Agent, OS, or Node.js major version changes, validation may need to be rerun.

## Publishing Rule

- Keep the root README, subproject READMEs, release notes, and compatibility statements aligned.
- Publish exact tested versions, operating systems, and known limitations in releases once validation is complete.
- If a specific Agent, Node.js version, or operating system is shipped with limitations, list it in release notes and troubleshooting docs.
