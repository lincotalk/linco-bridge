# 工作原理

[English](../how-it-works.md)

```text
本地 Agent CLI
    ↕ 本地进程、Gateway 或 session 文件
用户电脑上的 linco-connect
    ↕ 已鉴权 WebSocket 连接
官方 Linco 通道、开源 Reference Platform 或兼容后端
    ↕
Linco App、Reference Web、自定义 H5/小程序/App/IM 客户端
```

仓库里有两个可运行子项目：

- `linco-bridge-connect` 是运行在 PC 上的连接器插件，负责适配本地 Agent、维护远端连接、转换会话和事件。
- `linco-bridge-platform` 是开源参考平台通道，包含后端 relay 和 H5 前端，对应连接器中的 `linco-demo` channel。

官方通道 `linco` 用于官方产品体验；开源通道 `linco-demo` 用于快速部署、验证链路和二次开发。团队也可以新增自己的 channel adapter，把同一套本地连接器接入自有 H5、小程序、App、Web 或 IM。

## 职责

- **本地 Agent：** 在用户电脑上执行提示词、工具和文件操作。
- **linco-connect：** 适配 Agent CLI，维护 channel/account/agent 连接，处理权限确认、附件和文件下发。
- **Reference Platform / Server：** 校验 demo 凭证，维护连接状态，转发客户端消息和连接器事件。
- **Client / Channel 前端：** 展示会话、发送消息、呈现流式输出和权限请求。

## 通道边界

| 通道 | 位置 | 用途 |
| --- | --- | --- |
| `linco` | `linco-bridge-connect/src/channel/linco/` | 官方 Linco 产品通道。 |
| `linco-demo` | `linco-bridge-connect/src/channel/lincoDemo/` + `linco-bridge-platform` | 开源参考平台通道，默认连接本机 `ws://127.0.0.1:3300/bridge/ws/<agent>`。 |
| 自定义通道 | 新增 `src/channel/<name>/` 并注册 adapter | 用于自有 H5、小程序、App、Web 或 IM 产品。 |

自定义 channel、命令改动、协议改动和官方通道兼容性的贡献规则见 [二次开发规则](secondary-development.md)。

## 边界

- Reference Platform 用于开发、集成验证和二次开发参考，不构成生产部署指南。
- 本地 `linco-demo` 默认使用 `ws://`，仅适合本机开发验证；公网部署应使用 TLS/WSS。
- TLS / WSS 保护传输，不代表已实现端到端加密。
- 同步会话索引不等于上传全部历史消息。
- 数据可见性、保留和删除策略取决于连接器、后端部署方式和客户端链路；连接真实数据前请先阅读安全与隐私文档。

## 详细文档

- [连接器架构说明](../../linco-bridge-connect/docs/architecture.md)
- [连接器协议说明](../../linco-bridge-connect/docs/protocol.md)
- [参考平台 README](../../linco-bridge-platform/README.md)
