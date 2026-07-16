# Hosted Reference Demo Deployment

[简体中文](zh-CN/deploy-demo.md)

This guide deploys the open reference platform to a public domain. Users open the H5 page or WeChat Mini Program, then run `linco-connect` on their own computer to connect a local Agent.

For local development, use the [Platform README](../linco-bridge-platform/README.md) instead.

## Scope

The hosted reference platform is an evaluation environment, not a production account or multi-tenant system. It uses signed anonymous visitor sessions to isolate connections, sessions, and messages. Clearing client storage, changing devices, or using private browsing may make previous demo state inaccessible.

Do not use a public demo for sensitive or production data. Custom deployments are responsible for authentication, retention, deletion, monitoring, and abuse controls.

```text
User client (H5 / mini program)
        │ HTTPS
        ▼
   Nginx (TLS)
   ├─ /           → H5 static files
   ├─ /api/*      → NestJS :3300
   └─ /bridge/ws  → NestJS WebSocket

User computer
   linco-connect ──WSS──► /bridge/ws
        │
   Local Agent CLI
```

Examples below use `bridge.example.com`. Replace it with your own domain.

## 1. Deploy the Server

```bash
cd linco-bridge-platform
docker compose up --build -d
```

Configure the server environment in `docker-compose.yml`:

```yaml
environment:
  PORT: '3300'
  PUBLIC_HOST: 'bridge.example.com'
  PUBLIC_HTTP_SCHEME: 'https'
  PUBLIC_WS_SCHEME: 'wss'
  SQLITE_PATH: /app/data/linco-bridge.db
  CORS_ORIGINS: 'https://bridge.example.com'
  VISITOR_SESSION_SECRET: '<random-secret>'
```

Generate a signing secret with a secure random generator, for example:

```bash
openssl rand -hex 32
```

| Variable | Hosted value | Purpose |
| --- | --- | --- |
| `PORT` | `3300` | HTTP and WebSocket port |
| `PUBLIC_HOST` | `bridge.example.com` | Host written into generated setup commands |
| `PUBLIC_HTTP_SCHEME` | `https` | Public REST scheme |
| `PUBLIC_WS_SCHEME` | `wss` | Public connector WebSocket scheme |
| `SQLITE_PATH` | `/app/data/linco-bridge.db` | Persistent SQLite path |
| `CORS_ORIGINS` | H5 origin | Browser origin allowlist; comma-separated when needed |
| `VISITOR_SESSION_SECRET` | Random secret | Required in production for signing visitor sessions |

When `PUBLIC_HOST` is not local, generated setup commands include the public WSS address automatically.

Health check:

```bash
curl https://bridge.example.com/api/demo-config
```

Verify that `apiBaseUrl` uses HTTPS and `wsBaseUrl` uses WSS.

## 2. Configure Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name bridge.example.com;

    ssl_certificate     /etc/letsencrypt/live/bridge.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bridge.example.com/privkey.pem;

    root /var/www/linco-bridge-h5;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

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

Keep buffering disabled for streaming API responses and preserve the WebSocket upgrade headers.

## 3. Build and Publish H5

Update [`../linco-bridge-platform/web/prod.env`](../linco-bridge-platform/web/prod.env) before building. Use your own API domain; do not point custom builds at the official Linco demo API.

```env
VITE_API_BASE_URL=https://bridge.example.com
VITE_USE_REMOTE_API=true
```

```bash
cd linco-bridge-platform/web
npm install
npm run build:h5
```

Publish the entire `dist/build/h5` directory, including `assets`, `static`, and `index.html`, to the Nginx root.

## 4. Build the WeChat Mini Program

```bash
cd linco-bridge-platform/web
npm install
npm run build:mp-weixin
```

1. Set `mp-weixin.appid` in `web/src/manifest.json`.
2. Import `dist/build/mp-weixin` into WeChat DevTools.
3. Add `https://bridge.example.com` as the request domain.
4. Add `wss://bridge.example.com` as the socket domain.
5. Complete any filing and review requirements before release.

`urlCheck: false` is suitable only for local development, not formal publication.

## 5. Validate the User Flow

1. Open the hosted H5 or mini program.
2. Go to **Bridge** and choose an Agent import path.
3. Copy the generated `setupCommands` and run them on the computer with the Agent CLI.
4. Return to the client and refresh the connection status.
5. Enter the Agent page and send a test message.

The generated commands should use `wss://bridge.example.com/bridge/ws/...`. Users also need the target Agent CLI and `linco-connect` installed locally.

## Operations

| Area | Minimum recommendation |
| --- | --- |
| Data | Persist the SQLite volume and define a cleanup policy |
| Monitoring | Probe `/api/demo-config`, process health, and WebSocket availability |
| Abuse control | Add rate limits and request-size limits |
| Backup | Back up the SQLite volume before upgrades |
| Secrets | Rotate leaked credentials and `VISITOR_SESSION_SECRET` |

## Troubleshooting

### Connector remains offline

- Confirm the generated command contains the correct public `--ws-url`.
- Confirm Nginx forwards WebSocket upgrade headers on `/bridge/ws`.
- Confirm the user's network permits outbound WSS.

### H5 works but the mini program fails

- Check request and socket domain allowlists.
- Confirm `VITE_API_BASE_URL` matches the deployment.
- Confirm the complete mini-program build was imported.

### Previous state is unavailable

The demo is scoped to an anonymous visitor session. Clearing storage, changing clients or devices, and private browsing may create a new visitor context. Durable recovery requires a separate account system.

### The deployed H5 is missing a tab or recent feature

Rebuild with `npm run build:h5`, upload the complete `dist/build/h5` directory, and hard-refresh the browser. The build should finish with `[verify-h5-tabbar] OK`.

## Related Documentation

- [Quick Start](quick-start.md)
- [Reference Web](reference-web.md)
- [Platform Server README](../linco-bridge-platform/server/README.md)
- [Security and Privacy](security-and-privacy.md)
