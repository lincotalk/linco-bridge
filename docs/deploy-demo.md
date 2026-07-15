# Hosted Demo Deployment

[中文](zh-CN/deploy-demo.md)

This guide explains how to deploy the **official hosted demo**: users open your H5 page or WeChat Mini Program, then run `linco-connect` on their own PC to bridge a local Agent.

For the local full-stack path where each user clones the repository and starts `server + web` themselves, see [`../linco-bridge-platform/README.md`](../linco-bridge-platform/README.md).

## Two Experience Paths

| Path | Who runs server | User PC needs | Best for |
| --- | --- | --- | --- |
| **Local full-stack demo** | Each user | server + web + `linco-connect` + Agent | GitHub developers, forks, secondary development |
| **Hosted demo** | Operator / maintainer | `linco-connect` + Agent only | Quick bridge validation and product showcase |

The hosted demo is a **public evaluation environment**. It typically does not provide a formal login system. State is usually isolated by browser-local cache together with an anonymous visitor identity. If local browser data is cleared, the device is changed, or an incognito session is used, local demo history and state may be lost.

If you intentionally run a shared demo environment without per-user isolation, document that clearly as well. Do not ask users to input sensitive information or production data into the public demo.

## Architecture

```text
User phone (H5 / mini program)
        │ HTTPS
        ▼
   Nginx (TLS termination)
   ├─ /           → H5 static files
   ├─ /api/*      → NestJS :3300
   └─ /bridge/ws  → NestJS WebSocket

User PC
   linco-connect ──WSS──► same /bridge/ws
        │
   Local Agent CLI (Codex / Claude / Hermes / OpenClaw)
```

## 1. Deploy Server

### Docker (recommended)

```bash
cd linco-bridge-platform
docker compose up --build -d
```

Set the environment variables in `docker-compose.yml` for the hosted demo deployment:

```yaml
environment:
  PORT: '3300'
  PUBLIC_HOST: 'bridge-demo.lincotalk.com'
  PUBLIC_HTTP_SCHEME: 'https'
  PUBLIC_WS_SCHEME: 'wss'
  SQLITE_PATH: /app/data/linco-bridge.db
  CORS_ORIGINS: 'https://bridge-demo.lincotalk.com'
  VISITOR_SESSION_SECRET: '<random-32b-hex>'
```

> **Third-party frontend policy:** The official hosted demo API (`bridge-demo.lincotalk.com`) accepts browser traffic **only** from the officially deployed H5 / mini program. If you fork or modify the `web` frontend, you must **self-host the server** and point `VITE_API_BASE_URL` at your own backend. Do **not** point third-party builds at the official demo server. The server enforces this with a `CORS_ORIGINS` whitelist for browser cross-origin requests.

### Environment Variables

| Variable | Local default | Hosted demo example | Description |
| --- | --- | --- | --- |
| `PORT` | `3300` | `3300` | HTTP and WebSocket port inside the container |
| `PUBLIC_HOST` | `127.0.0.1` | `bridge-demo.lincotalk.com` | Written into `demo-config` and generated setup commands |
| `PUBLIC_HTTP_SCHEME` | local `http`, otherwise `https` | `https` | REST base URL scheme |
| `PUBLIC_WS_SCHEME` | local `ws`, otherwise `wss` | `wss` | connector WebSocket scheme |
| `SQLITE_PATH` | `./data/linco-bridge.db` | `/app/data/linco-bridge.db` | SQLite file path |
| `CORS_ORIGINS` | dev unset → allow-all; **prod unset → deny cross-origin** | `https://bridge-demo.lincotalk.com` | Browser CORS whitelist; **required** for hosted demo |
| `VISITOR_SESSION_SECRET` | dev fallback exists | random long string (required) | Production visitor session signing secret |

When `PUBLIC_HOST` is not `127.0.0.1` or `localhost`, the generated `setupCommands` automatically include:

```bash
linco-connect init ... --ws-url wss://bridge-demo.lincotalk.com/bridge/ws/codex
```

For local development, keep the local defaults. Local commands usually omit `--ws-url` and instead rely on `--allow-insecure-ws`.

### Health Check

```bash
curl https://bridge-demo.lincotalk.com/api/demo-config
```

The expected result should expose:

- `apiBaseUrl` as `https://bridge-demo.lincotalk.com`
- `wsBaseUrl` as `wss://bridge-demo.lincotalk.com/bridge/ws`

## 2. Nginx Reverse Proxy

For the official hosted demo domain `bridge-demo.lincotalk.com`:

```nginx
server {
    listen 443 ssl http2;
    server_name bridge-demo.lincotalk.com;

    ssl_certificate     /etc/letsencrypt/live/bridge-demo.lincotalk.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bridge-demo.lincotalk.com/privkey.pem;

    root /var/www/linco-bridge-h5;
    index index.html;

    # H5 static files (UniApp hash routing)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # REST API
    location /api/ {
        proxy_pass http://127.0.0.1:3300;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }

    # Bridge WebSocket
    location /bridge/ws {
        proxy_pass http://127.0.0.1:3300;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}
```

Key points:

- Keep `proxy_buffering off` for `/api/` so SSE or streaming responses are not buffered.
- Keep WebSocket upgrade headers on `/bridge/ws`.
- Public deployment should use HTTPS and WSS rather than plain HTTP / WS.

## 3. Build And Publish H5

Production environment variables live in [`../linco-bridge-platform/web/prod.env`](../linco-bridge-platform/web/prod.env). `npm run build:h5` loads them automatically.

```bash
cd linco-bridge-platform/web
npm install
npm run build:h5
```

Deploy the entire `dist/build/h5` directory, including `assets/` and `static/`, to your static hosting root.

If static files and API are served from different origins, update `VITE_API_BASE_URL` in `prod.env` and rebuild.

## 4. Publish WeChat Mini Program

```bash
cd linco-bridge-platform/web
npm run build:mp-weixin
```

1. Set `mp-weixin.appid` in `web/src/manifest.json`.
2. Import `dist/build/mp-weixin` into WeChat DevTools.
3. Configure allowed domains in the WeChat Mini Program console:
   - request domain: `https://bridge-demo.lincotalk.com`
   - socket domain: `wss://bridge-demo.lincotalk.com`
4. Before formal release, the domain should complete the required ICP filing.

During development, `urlCheck: false` may be used temporarily. For release, use the formal allowed-domain configuration.

## 5. End-User Flow

This section can be copied into product-facing onboarding docs:

1. Open [https://bridge-demo.lincotalk.com](https://bridge-demo.lincotalk.com) or the WeChat Mini Program.
2. Go to **Bridge** and choose an Agent import path such as **Import from Codex**.
3. Copy the generated `setupCommands` and run them in the local terminal.
4. Return to the page and click the button that refreshes or checks connection status.
5. After the connector is detected, enter the Agent landing page and send a test message.

The user's computer must already have the target Agent CLI installed. The connector should also be installed globally:

```bash
npm install -g linco-connect
```

## 6. Publish `linco-connect` On npm

Both GitHub users and hosted-demo users depend on the npm-published connector package:

```bash
cd linco-bridge-connect
npm publish
```

In release notes, clarify that:

- hosted-demo users should follow the generated `setupCommands`, especially the `--ws-url`;
- local full-stack demo users can usually omit that hosted `--ws-url`.

## 7. Suggested GitHub Release Notes

Each public release should ideally include:

- **Local demo path:** clone repository and quick-start links for `server + web`
- **Hosted demo path:** hosted URL and mini program entry if available
- **Supported Agents:** Codex, Claude Code, Hermes, OpenClaw
- **Disclaimer:** public evaluation environment, not production SaaS, and not suitable for sensitive data

## 8. Demo-Grade Operations

| Item | Recommendation |
| --- | --- |
| Data cleanup | Periodically reset or clean the SQLite volume because public demos accumulate stale data |
| Monitoring | Probe `GET /api/demo-config` and basic process health |
| Rate limiting | Add Nginx `limit_req` or equivalent controls |
| Backup | Copy the `linco-bridge.db` file or mounted volume |

## 9. Common Issues

### The page opens but the connector always shows offline

- Confirm the local command includes `--ws-url wss://your-domain/bridge/ws/...` for hosted deployment.
- Confirm Nginx `/bridge/ws` has WebSocket upgrade headers.
- Confirm the local firewall allows outbound WSS.

### H5 works but the mini program does not

- Check the mini program allowed domains and filing requirements.
- Confirm `VITE_API_BASE_URL` in `prod.env` matches the deployed environment.
- Confirm the full `assets/` directory was uploaded.

### Multiple users keep disconnecting each other

- If your demo shares one connector slot per Agent type, that is expected behavior in a shared demo.
- If you need isolation, use per-user browser-local state plus anonymous visitor IDs, or provide independent demo environments.
- If you need true local isolation for each evaluator, use the **local full-stack demo** path instead.

### Assistant tab works locally but is missing online

- **Cause**: The hosted H5 bundle is stale. An older build had only two tabBar entries (Messages / Bridge) while the router still reserved `pages/agents/index` at `tabBarIndex: 1`, which leaves an empty middle slot.
- **Fix**: Run `npm run build:h5` under `linco-bridge-platform/web`, then upload the entire `dist/build/h5` directory (`assets/`, `static/`, `index.html`) to the Nginx root (for example `/var/www/linco-bridge-h5`). Do not deploy only the server or individual icon files.
- **Verify**: The build should end with `[verify-h5-tabbar] OK`; after a hard refresh the footer should show Messages | Assistant | Bridge.

## Related Docs

- [Quick Start](quick-start.md)
- [Reference Web](reference-web.md)
- [Platform README](../linco-bridge-platform/README.md)
- [Platform Server README](../linco-bridge-platform/server/README.md)
