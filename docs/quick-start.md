# Quick Start

[简体中文](zh-CN/quick-start.md)

## Prerequisites

- A supported operating system and Node.js version.
- At least one supported local agent CLI installed and working locally.
- Credentials created in the Reference Web or Linco App.

## Install and connect

```bash
npm install -g linco-connect
linco-connect init --token "<app-id>:<app-secret>" --agent codex
linco-connect start --daemon
```

Return to the client, confirm the device is online, open a recent session, and send a short test message.

For Hermes or OpenClaw, complete the additional profile or agent binding step shown in the client after the connector comes online.

## Stop

```bash
linco-connect stop
```
