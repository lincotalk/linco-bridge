# Quick Start

[简体中文](zh-CN/quick-start.md)

Linco Bridge has three common evaluation paths:

- **Official Linco channel (`linco`):** for the official product flow without deploying the platform project.
- **Open reference platform (`linco-demo`):** for local validation, self-hosting evaluation, and secondary development. This requires starting `linco-bridge-platform`.
- **Official hosted demo:** for users who want to try the bridge without deploying the reference platform.

## Minimal Flow

The official channel usually only requires installing the connector, initializing credentials, and starting it:

```bash
npm install -g linco-connect
linco-connect init --token "<app-id>:<app-secret>" --agent codex
linco-connect start --daemon
```

For the open reference platform, start the backend and H5 frontend in separate terminals:

```bash
cd linco-bridge-platform/server
npm install
npm run start:dev
```

```bash
cd linco-bridge-platform/web
npm install
npm run dev:h5
```

Open the H5 URL, go to **Bridge → Import from Codex**, copy the generated `setupCommands`, run them locally, then return to the page and refresh the connection status.

A typical command shape looks like this for reference, while the page-generated `setupCommands` remain the source of truth:

```bash
npm install -g linco-connect
linco-connect init --token "<app-id>:<app-secret>" --agent codex --channel linco-demo --account "<account-id>" --allow-insecure-ws
linco-connect start --daemon
```

For the official hosted experience, choose one of the two public entries first:

**Hosted H5:** open [https://bridge-demo.lincotalk.com](https://bridge-demo.lincotalk.com).

**WeChat Mini Program:** scan the QR code below, or search `agent桥接器` in WeChat. The current mini-program flow uses **QR-code sign-in**.

<p align="center">
  <img src="images/demo/mini-program-qr.png" alt="Linco Bridge WeChat Mini Program QR code" width="220" />
</p>

After entering either entry, follow **Bridge → Import from Codex → copy setupCommands → run them locally → get connection status → enter chat**.

The QR code may expire; search `agent桥接器` in WeChat if needed. The hosted demo is for evaluation and should not be used for sensitive or production data. To deploy your own instance, see [Hosted Demo Deployment](deploy-demo.md).

## Detailed Docs

- [Connector installation, initialization, and commands](../linco-bridge-connect/README.en-US.md)
- [Reference platform startup and setup flow](../linco-bridge-platform/README.md)
- [Hosted demo deployment](deploy-demo.md)
- [CLI entry](cli.md)
- [Troubleshooting](troubleshooting.md)

## Stop

```bash
linco-connect stop
```
