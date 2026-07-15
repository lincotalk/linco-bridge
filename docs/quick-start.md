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

For the open reference platform, start the backend first, verify `http://127.0.0.1:3300/api/demo-config`, then start the H5 frontend. After opening the H5 dev URL, go to **Bridge → Import from Codex**, copy the generated `setupCommands`, run them on your local machine, then return to the page and confirm the connection status.

A typical command shape looks like this for reference, while the page-generated `setupCommands` remain the source of truth:

```bash
npm install -g linco-connect
linco-connect init --token "demo-codex-app:demo-codex-secret" --agent codex --channel linco-demo --account codex_1 --allow-insecure-ws
linco-connect start --daemon
```

For the official hosted experience, choose one of the two public entries first:

**Hosted H5:** open [https://bridge-demo.lincotalk.com](https://bridge-demo.lincotalk.com).

**WeChat Mini Program:** scan the QR code below, or search `agent桥接器` in WeChat. The current mini-program flow uses **QR-code sign-in**.

<p align="center">
  <img src="images/demo/mini-program-qr.png" alt="Linco Bridge WeChat Mini Program QR code" width="220" />
</p>

After entering either entry, follow **Bridge → Import from Codex → copy setupCommands → run them locally → get connection status → enter chat**.

Note: the experience QR code may expire. Please use the latest image in this repository or search `agent桥接器` in WeChat.

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
