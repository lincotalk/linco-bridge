# 在线参考 Demo 部署

[English](../deploy-demo.md)

本文档说明如何将开源参考平台部署到公网域名。用户打开 H5 或微信小程序，然后在自己的电脑上运行 `linco-connect` 连接本地 Agent。

本地开发请使用 [参考平台 README](../../linco-bridge-platform/README.zh-CN.md)。

## 适用范围

在线参考平台是体验环境，不是生产级账号或多租户系统。它使用签名匿名访客 Session 隔离连接、会话和消息。清理客户端存储、更换设备或使用无痕模式后，之前的 Demo 状态可能无法继续访问。

请勿在公共 Demo 中使用敏感或正式业务数据。自定义部署需自行负责鉴权、保留、删除、监控和滥用防护。

```text
用户客户端（H5 / 小程序）
        │ HTTPS
        ▼
   Nginx（TLS）
   ├─ /           → H5 静态资源
   ├─ /api/*      → NestJS :3300
   └─ /bridge/ws  → NestJS WebSocket

用户电脑
   linco-connect ──WSS──► /bridge/ws
        │
   本地 Agent CLI
```

下文使用 `bridge.example.com` 作为示例，请替换为自己的域名。

## 1. 部署 Server

```bash
cd linco-bridge-platform
docker compose up --build -d
```

在 `docker-compose.yml` 中配置 Server 环境变量：

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

使用安全随机方式生成签名密钥，例如：

```bash
openssl rand -hex 32
```

| 变量 | 公网值 | 作用 |
| --- | --- | --- |
| `PORT` | `3300` | HTTP 和 WebSocket 端口 |
| `PUBLIC_HOST` | `bridge.example.com` | 写入页面生成的连接命令 |
| `PUBLIC_HTTP_SCHEME` | `https` | 公网 REST scheme |
| `PUBLIC_WS_SCHEME` | `wss` | 公网 connector WebSocket scheme |
| `SQLITE_PATH` | `/app/data/linco-bridge.db` | 持久化 SQLite 路径 |
| `CORS_ORIGINS` | H5 Origin | 浏览器 Origin 白名单，多个值用逗号分隔 |
| `VISITOR_SESSION_SECRET` | 随机密钥 | 生产环境必填，用于签名访客 Session |

`PUBLIC_HOST` 不是本地地址时，页面生成的连接命令会自动包含公网 WSS 地址。

健康检查：

```bash
curl https://bridge.example.com/api/demo-config
```

确认 `apiBaseUrl` 使用 HTTPS，`wsBaseUrl` 使用 WSS。

## 2. 配置 Nginx

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

流式 API 请求需要关闭缓冲，`/bridge/ws` 需要保留 WebSocket 升级 Header。

## 3. 构建并发布 H5

构建前更新 [`../../linco-bridge-platform/web/prod.env`](../../linco-bridge-platform/web/prod.env)。使用自己的 API 域名，不要将自定义构建指向 Linco 官方 Demo API。

```env
VITE_API_BASE_URL=https://bridge.example.com
VITE_USE_REMOTE_API=true
```

```bash
cd linco-bridge-platform/web
npm install
npm run build:h5
```

将完整的 `dist/build/h5` 目录发布到 Nginx root，包括 `assets`、`static` 和 `index.html`。

## 4. 构建微信小程序

```bash
cd linco-bridge-platform/web
npm install
npm run build:mp-weixin
```

1. 在 `web/src/manifest.json` 中设置 `mp-weixin.appid`。
2. 将 `dist/build/mp-weixin` 导入微信开发者工具。
3. 将 `https://bridge.example.com` 配置为 request 合法域名。
4. 将 `wss://bridge.example.com` 配置为 socket 合法域名。
5. 正式发布前完成必要的备案和审核。

`urlCheck: false` 仅用于本地开发，不应用于正式发布。

## 5. 验证用户流程

1. 打开已部署的 H5 或小程序。
2. 进入 **桥接**，选择 Agent 导入方式。
3. 复制页面生成的 `setupCommands`，在已安装 Agent CLI 的电脑上执行。
4. 返回客户端刷新连接状态。
5. 进入 Agent 页并发送测试消息。

生成的命令应使用 `wss://bridge.example.com/bridge/ws/...`。用户电脑上还需要安装目标 Agent CLI 和 `linco-connect`。

## 运维

| 区域 | 最低建议 |
| --- | --- |
| 数据 | 持久化 SQLite volume，并定义清理策略 |
| 监控 | 检测 `/api/demo-config`、进程和 WebSocket 可用性 |
| 滥用防护 | 增加限流和请求大小限制 |
| 备份 | 升级前备份 SQLite volume |
| 密钥 | 泄露后更换连接凭证和 `VISITOR_SESSION_SECRET` |

## 排障

### Connector 始终离线

- 确认生成命令包含正确的公网 `--ws-url`。
- 确认 Nginx 在 `/bridge/ws` 上转发 WebSocket 升级 Header。
- 确认用户网络允许出站 WSS。

### H5 正常，小程序失败

- 检查 request 和 socket 合法域名。
- 确认 `VITE_API_BASE_URL` 与部署一致。
- 确认导入了完整的小程序构建产物。

### 无法访问之前的状态

Demo 按匿名访客 Session 隔离。清理存储、更换客户端或设备、使用无痕模式可能会创建新的访客上下文。持久恢复需要额外的账号系统。

### 部署的 H5 缺少 Tab 或最新功能

重新执行 `npm run build:h5`，上传完整的 `dist/build/h5` 目录，然后强制刷新浏览器。构建应以 `[verify-h5-tabbar] OK` 结束。

## 相关文档

- [快速开始](quick-start.md)
- [Reference Web](reference-web.md)
- [Server README](../../linco-bridge-platform/server/README.zh-CN.md)
- [安全与隐私](security-and-privacy.md)
