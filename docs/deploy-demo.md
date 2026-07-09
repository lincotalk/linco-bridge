# Hosted Demo Deployment

[中文](zh-CN/deploy-demo.md)

This guide covers deploying the **official hosted demo**: users open your H5 or WeChat mini program and run `linco-connect` on their PC to bridge a local Agent.

For a full local stack (clone repo, run server + web), see [`../linco-bridge-platform/README.md`](../linco-bridge-platform/README.md).

## Two experience paths

| Path | Who runs server | User PC needs | Best for |
| --- | --- | --- | --- |
| **Local full-stack demo** | Each user | server + web + linco-connect + Agent | GitHub developers, forks |
| **Hosted demo** | You | linco-connect + Agent only | Quick bridge validation |

The hosted demo is a **shared playground**: no login, shared data, one connector slot per Agent type (last connection wins).

## Architecture

```text
Phone (H5 / mini program)
        │ HTTPS
        ▼
   Nginx (TLS)
   ├─ /           → H5 static
   ├─ /api/*      → NestJS :3300
   └─ /bridge/ws  → NestJS WebSocket

User PC
   linco-connect ──WSS──► /bridge/ws
        │
   Local Agent CLI
```

## 1. Deploy server

Set environment variables for the official hosted demo at [https://bridge-demo.lincotalk.com](https://bridge-demo.lincotalk.com):

```yaml
PORT: '3300'
PUBLIC_HOST: 'bridge-demo.lincotalk.com'
PUBLIC_HTTP_SCHEME: 'https'
PUBLIC_WS_SCHEME: 'wss'
SQLITE_PATH: /app/data/linco-bridge.db
```

When `PUBLIC_HOST` is not loopback, setup commands include:

```bash
linco-connect init ... --ws-url wss://bridge-demo.lincotalk.com/bridge/ws/codex
```

Health check:

```bash
curl https://bridge-demo.lincotalk.com/api/demo-config
```

## 2. Nginx

See the Chinese doc for a full sample: [`zh-CN/deploy-demo.md`](zh-CN/deploy-demo.md) — sections on TLS, `/api/` SSE (`proxy_buffering off`), and `/bridge/ws` upgrade headers.

## 3. Build H5

Same-origin (recommended):

```bash
cd linco-bridge-platform/web
npm run build:h5
```

Cross-origin:

```bash
VITE_API_BASE_URL=https://bridge-demo.lincotalk.com npm run build:h5
```

Deploy `dist/build/h5` to static hosting.

## 4. WeChat mini program

```bash
VITE_API_BASE_URL=https://bridge-demo.lincotalk.com npm run build:mp-weixin
```

Configure the `manifest.json` appid and the allowed request and WebSocket domains in the WeChat Mini Program console.

## 5. User flow

1. Open hosted H5 or mini program
2. **Bridge** → import Agent → copy `setupCommands`
3. Run commands on PC → confirm connection on page
4. Enter chat and send a test message

## 6. Publish `linco-connect` on npm

```bash
cd linco-bridge-connect
npm publish
```

## Related

- [Quick start](quick-start.md)
- [Reference Web](reference-web.md)
