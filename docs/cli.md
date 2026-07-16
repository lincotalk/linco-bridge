# CLI Reference

[简体中文](zh-CN/cli.md)

This page covers the common `linco-connect` lifecycle. For complete syntax and adapter-specific behavior, see:

- [Linco Bridge connector README](../linco-bridge-connect/README.en-US.md)
- [Slash Commands](../linco-bridge-connect/docs/slash-commands.en-US.md)
- [Connector Security](../linco-bridge-connect/docs/security.en-US.md)

## What The CLI Does

`linco-connect` runs on the user's computer. It connects a local Agent CLI to a remote channel, relays messages and tool events, handles permission confirmations, and returns attachments or generated files when allowed.

## Common Lifecycle Commands

```bash
linco-connect init --token "<appId>:<appSecret>" --agent codex
linco-connect start --daemon
linco-connect doctor
linco-connect stop
```

Related lifecycle commands:

| Command | Purpose |
| --- | --- |
| `linco-connect init` | Writes local configuration for an Agent account. |
| `linco-connect start` | Starts the connector in the foreground. |
| `linco-connect start --daemon` | Starts the connector as a background service. |
| `linco-connect reload` | Reloads runtime configuration for the running service. |
| `linco-connect doctor` | Checks local runtime, CLI, and environment health. |
| `linco-connect stop` | Stops the background service. |
| `linco-connect remove-account` | Removes a configured Agent account. |

## Initialization Patterns

### Official Linco channel

Omit `--channel` during initialization, as shown in the common lifecycle example above, to use the default `linco` channel. Choose this path for the official product experience when you do not need to deploy the open reference platform.

### Open reference platform (`linco-demo`)

```bash
linco-connect init \
  --token "<appId>:<appSecret>" \
  --agent codex \
  --channel linco-demo \
  --account "<accountId>" \
  --allow-insecure-ws
```

Use this for local validation or self-hosted evaluation of `linco-bridge-platform`. For local development, `--allow-insecure-ws` is commonly required because the default local bridge uses `ws://127.0.0.1:3300`.

### Hosted demo

For hosted-demo users, the generated `setupCommands` on the Bridge page are the source of truth. In hosted deployments, the generated command usually includes `--ws-url wss://.../bridge/ws/<agent>`.

## Session And Remote Commands

After setup, remote sessions can use local connector commands for Agent context and version maintenance:

| Area | Examples |
| --- | --- |
| Local slash commands in remote sessions | `/help`, `/status`, `/approve`, `/get`, `/project`, `/history`, `/profile`, `/agent` |
| Version maintenance | `/update check`, `/update latest`, `/update <version>` |

For Claude and Codex flows, the connector can also list projects, bind existing sessions, sync local history, and expose PC-side open commands. For Hermes and OpenClaw, it can bind the default profile or agent used for future sessions.

## Approval And File Rules

Some important operational rules are easy to miss if users only look at the setup commands:

- `manual`, `auto`, and `yolo` approval modes affect how permission requests and dangerous operations are handled.
- `/get <path>` should only return validated non-hidden files under allowed directories.
- Hosted or public deployments should use `wss://`; `ws://` is only for trusted local development.
- Local credentials and connector config remain on the user's machine and should not be committed or shared.

## When To Use Detailed Docs

Use the linked connector docs when you need:

- the complete slash-command list and structured result shapes;
- environment-variable overrides such as `LINCO_<AGENT>_WS_URL`;
- exact configuration structure in `.linco/config.json`;
- adapter-specific differences between Codex, Claude Code, Hermes, and OpenClaw;
- self-update, file-delivery, and security edge cases.
