# Quick Start

[简体中文](zh-CN/quick-start.md)

Linco Bridge has three common evaluation paths:

- **Official Linco channel (`linco`):** for the official product flow without deploying the platform project.
- **Open reference platform (`linco-demo`):** for local validation, self-hosting evaluation, and secondary development. This requires starting `linco-bridge-platform`.
- **Official hosted demo:** for teams that already provide a hosted H5 or WeChat Mini Program experience while users run `linco-connect` on their own PCs.

## Minimal Flow

The official channel usually only requires installing the connector, initializing credentials, and starting it:

```bash
npm install -g linco-connect
linco-connect init --token "<app-id>:<app-secret>" --agent codex
linco-connect start --daemon
```

For the open reference platform, start the backend first, verify `http://127.0.0.1:3300/api/demo-config`, then start the H5 frontend. After opening the H5 dev URL, go to **桥接 → 从 Codex 导入** and copy the generated setup commands. The command uses `--channel linco-demo`; local development also includes `--allow-insecure-ws`.

For the official hosted demo, users usually only need to:

1. open the hosted H5 page or WeChat Mini Program;
2. go to **Bridge**, import an Agent, and copy the generated `setupCommands`;
3. run `linco-connect` plus the target Agent CLI on their own PC.

To use the official hosted demo, open [https://bridge-demo.lincotalk.com](https://bridge-demo.lincotalk.com). To deploy your own hosted demo, see [Hosted Demo Deployment](deploy-demo.md).

## Detailed Docs

- [Connector installation, initialization, and commands](../linco-bridge-connect/README.en-US.md)
- [Reference platform startup and demo credentials](../linco-bridge-platform/README.md)
- [Hosted demo deployment](deploy-demo.md)
- [CLI entry](cli.md)
- [Troubleshooting](troubleshooting.md)

## Stop

```bash
linco-connect stop
```
