# Quick Start

[简体中文](zh-CN/quick-start.md)

Linco Bridge has two common evaluation paths:

- **Official Linco channel (`linco`):** for the official product flow without deploying the platform project.
- **Open reference platform (`linco-demo`):** for local validation, self-hosting evaluation, and secondary development. This requires starting `linco-bridge-platform`.

## Minimal Flow

The official channel usually only requires installing the connector, initializing credentials, and starting it:

```bash
npm install -g linco-connect
linco-connect init --token "<app-id>:<app-secret>" --agent codex
linco-connect start --daemon
```

For the open reference platform, start the backend and H5 frontend first, then copy the generated setup commands from the H5 bridge page. The command uses `--channel linco-demo`; local development also includes `--allow-insecure-ws`.

## Detailed Docs

- [Connector installation, initialization, and commands](../linco-bridge-connect/README.en-US.md)
- [Reference platform startup and demo credentials](../linco-bridge-platform/README.md)
- [CLI entry](cli.md)
- [Troubleshooting](troubleshooting.md)

## Stop

```bash
linco-connect stop
```
