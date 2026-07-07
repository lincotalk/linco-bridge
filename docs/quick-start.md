# Quick Start

[简体中文](zh-CN/quick-start.md)

> Verify every command against the final release before publication.

## Prerequisites

- A supported operating system and Node.js version.
- Codex or Claude Code installed and working locally.
- Credentials created in the Reference Web or Linco App.

## Install and connect

```bash
npm install -g linco-connect
linco-connect init --token "<app-id>:<app-secret>" --agent codex
linco-connect start --daemon
```

Return to the client, confirm the device is online, open a recent session, and send a short test message.

## Stop

```bash
linco-connect stop
```

If the final command, package name, or flow changes, update this file, README, CLI `--help`, and the demo together.

