# 在线 Demo 部署指南

[English](../deploy-demo.md)

本文说明如何部署 **官方托管 Demo**：用户打开你们提供的 H5 / 微信小程序，在本机执行 `linco-connect` 连接自己的 Agent。

本地全栈体验（clone 后自己起 server + web）见 [`../../linco-bridge-platform/README.zh-CN.md`](../../linco-bridge-platform/README.zh-CN.md)。

## 两种体验方式

| 方式 | 谁部署 server | 用户本机需要什么 | 适用场景 |
| --- | --- | --- | --- |
| **本地全栈 Demo** | 用户自己 | server + web + linco-connect + Agent | GitHub 开发者、二次开发 |
| **在线 Demo** | 你们 | 仅 linco-connect + Agent | 快速体验桥接链路 |

在线 Demo 为 **公共演示环境**：无登录、数据共享、每种 Agent 同时仅一个 connector 在线（后连踢先连）。

## 架构

```text
用户手机（H5 / 小程序）
        │ HTTPS
        ▼
   Nginx（TLS 终结）
   ├─ /           → H5 静态资源
   ├─ /api/*      → NestJS :3300
   └─ /bridge/ws  → NestJS WebSocket

用户电脑
   linco-connect ──WSS──► 同上 /bridge/ws
        │
   本机 Agent（Codex / Claude / Hermes / OpenClaw）
```

## 1. 部署 Server

### Docker（推荐）

```bash
cd linco-bridge-platform
docker compose up --build -d
```

`docker-compose.yml` 中设置环境变量（官方在线 Demo）：

```yaml
environment:
  PORT: '3300'
  PUBLIC_HOST: 'bridge-demo.lincotalk.com'
  PUBLIC_HTTP_SCHEME: 'https'
  PUBLIC_WS_SCHEME: 'wss'
  SQLITE_PATH: /app/data/linco-bridge.db
```

### 环境变量

| 变量 | 本地默认 | 在线 Demo 示例 | 说明 |
| --- | --- | --- | --- |
| `PORT` | `3300` | `3300` | 容器内 HTTP/WS 端口 |
| `PUBLIC_HOST` | `127.0.0.1` | `bridge-demo.lincotalk.com` | 写入 demo-config 与 setup 命令 |
| `PUBLIC_HTTP_SCHEME` | 本地 `http`，否则 `https` | `https` | REST 根地址 scheme |
| `PUBLIC_WS_SCHEME` | 本地 `ws`，否则 `wss` | `wss` | connector WebSocket scheme |
| `SQLITE_PATH` | `./data/linco-bridge.db` | `/app/data/...` | SQLite 文件路径 |

当 `PUBLIC_HOST` 不是 `127.0.0.1` / `localhost` 时，导入页生成的 `setupCommands` 会自动带上：

```bash
linco-connect init ... --ws-url wss://bridge-demo.lincotalk.com/bridge/ws/codex
```

本地开发保持原样（不含 `--ws-url`，使用 `--allow-insecure-ws`）。

### 健康检查

```bash
curl https://bridge-demo.lincotalk.com/api/demo-config
```

期望返回 `apiBaseUrl` 为 `https://bridge-demo.lincotalk.com`，`wsBaseUrl` 为 `wss://bridge-demo.lincotalk.com/bridge/ws`。

## 2. Nginx 反向代理

官方在线 Demo 域名 `bridge-demo.lincotalk.com`：

```nginx
server {
    listen 443 ssl http2;
    server_name bridge-demo.lincotalk.com;

    ssl_certificate     /etc/letsencrypt/live/bridge-demo.lincotalk.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bridge-demo.lincotalk.com/privkey.pem;

    root /var/www/linco-bridge-h5;
    index index.html;

    # H5 静态（UniApp hash 路由）
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
        proxy_buffering off;          # SSE 流式
        proxy_read_timeout 3600s;
    }

    # Bridge WebSocket（connector 连这里）
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

## 3. 构建并发布 H5

### 同域部署（推荐）

H5 与 `/api` 同域名时，构建可不带 API 前缀，由 Nginx 反代：

```bash
cd linco-bridge-platform/web
npm install
npm run build:h5
```

产物目录：`dist/build/h5` → 上传到 Nginx `root`。

### 跨域部署

若静态与 API 不同域：

```bash
VITE_API_BASE_URL=https://bridge-demo.lincotalk.com npm run build:h5
```

## 4. 发布微信小程序

```bash
cd linco-bridge-platform/web
VITE_API_BASE_URL=https://bridge-demo.lincotalk.com npm run build:mp-weixin
```

1. 在 `web/src/manifest.json` 填写 `mp-weixin.appid`
2. 微信开发者工具导入 `dist/build/mp-weixin`
3. **开发管理 → 开发设置 → 服务器域名**：
   - request 合法域名：`https://bridge-demo.lincotalk.com`
   - socket 合法域名：`wss://bridge-demo.lincotalk.com`
4. 提审前域名需 **ICP 备案**

开发阶段可临时设 `urlCheck: false`，正式版必须配置合法域名。

## 5. 用户侧体验流程（文档可原文复制）

1. 打开 [https://bridge-demo.lincotalk.com](https://bridge-demo.lincotalk.com) 或微信小程序
2. 进入 **桥接** → 选择 Agent（如 **从 Codex 导入**）
3. 复制页面 `setupCommands`，在本机终端执行
4. 回到页面点击 **我已复制，获取连接状态**
5. 连接成功后进入 Agent 落地页并发测试消息

本机需已安装对应 Agent CLI，并已全局安装 connector：

```bash
npm install -g linco-connect
```

## 6. 发布 npm 包 `linco-connect`

GitHub 用户与在线 Demo 用户都依赖 npm 上的 connector：

```bash
cd linco-bridge-connect
npm publish
```

建议在 Release Notes 中注明：在线 Demo 以导入页生成的 `--ws-url` 为准；本地全栈 Demo 可省略该参数。

## 7. GitHub Release 建议

Release 中至少包含：

- **本地 Demo**：clone → `server` + `web` 快速开始链接
- **在线 Demo**：[https://bridge-demo.lincotalk.com](https://bridge-demo.lincotalk.com)、小程序名称/码
- **支持 Agent**：Codex、Claude Code、Hermes、OpenClaw
- **免责声明**：公共演示、数据共享、非生产环境

## 8. 运维（Demo 级）

| 项 | 建议 |
| --- | --- |
| 数据清理 | 定期删除或重置 SQLite volume（公共展台会积累脏数据） |
| 监控 | 探测 `GET /api/demo-config` + 进程存活 |
| 限流 | Nginx `limit_req` 防止接口被刷 |
| 备份 | 拷贝 `linco-bridge.db` 即可 |

## 9. 常见问题

### 页面连上但 connector 一直离线

- 确认本机命令含 `--ws-url wss://你的域名/bridge/ws/...`
- 确认 Nginx `/bridge/ws` 已配置 WebSocket 升级
- 本机防火墙是否放行出站 WSS

### H5 能开、小程序不行

- 检查小程序合法域名与备案
- 确认 `VITE_API_BASE_URL` 与构建时一致

### 多人同时演示互相踢线

- 在线 Demo 每种 Agent 仅一个 connector 槽，属预期行为
- 需要独立环境请走 **本地全栈 Demo**

## 相关文档

- [快速开始](quick-start.md)
- [Reference Web](reference-web.md)
- [平台 README](../../linco-bridge-platform/README.zh-CN.md)
- [Server README](../../linco-bridge-platform/server/README.zh-CN.md)
