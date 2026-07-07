# Linco Bridge

[English](README.md)

> 一个开放的桥接层，用来把本地 AI Agent 工具连接到 Web、移动端和 IM 客户端。

**项目状态：** Open Source Alpha。接口、兼容性和文档仍可能变化，但首期开源版本以四个已支持 Agent 和可用 SDK 能力为目标。

## 它是什么

Linco Bridge 帮助团队把原本只停留在一台电脑上的本地 AI Agent 工具，连接到更多产品入口。它提供本地连接器、参考平台，以及可复用的 SDK / 协议层，方便你：

- 用 Reference Web 验证完整桥接链路；
- 将本地 Agent 接入自有 Web、App 或 IM 产品；
- 基于公开协议和 SDK 边界构建兼容集成。

## 仓库包含什么

这个仓库当前主要包含三部分：

- `linco-bridge-connect`：运行在用户电脑上的本地连接器 CLI，负责把本地 Agent 会话桥接到兼容客户端和服务端；
- `linco-bridge-platform`：自托管 demo/reference platform，包含 NestJS 后端和 UniApp 前端；
- `docs/`：项目级文档，覆盖快速开始、工作原理、协议、安全和排障。

这个仓库 **不包含** 完整的 Linco App 产品本体，也不包含托管云服务。

## 工作方式

```text
本地 Agent CLI
    ↕ 本地进程、网关或会话文件
linco-bridge-connect（运行在用户电脑上）
    ↕ 认证后的桥接连接
Reference Server 或兼容后端
    ↕
Reference Web、Linco App 或第三方客户端
```

`linco-bridge-connect` 运行在用户电脑上，负责适配本地 Agent，并把会话、消息、权限请求、附件和生成文件中继到兼容产品中。

## 典型使用场景

- 想验证“本地 Agent 到客户端”完整桥接链路的开发者；
- 希望把本地 AI 工具接入自家 App、Web 或 IM 的产品团队；
- 想先参考一套实现，再构建自有兼容栈的工程团队。

## 快速开始

安装本地连接器：

```bash
npm install -g linco-connect
```

用已签发的凭证初始化设备：

```bash
linco-connect init \
  --token "<app-id>:<app-secret>" \
  --agent codex \
  --device-name codex1
```

启动连接器：

```bash
linco-connect start --daemon
```

然后打开兼容客户端，确认设备上线，进入一个会话并发送测试消息。

完整流程见 [快速开始](docs/zh-CN/quick-start.md)。

## 支持的 Agent

| Agent | 状态 | 说明 |
| --- | --- | --- |
| Codex CLI | 首期开源支持 | 首期开源版本同步提供连接器、参考平台和完整桥接链路。 |
| Claude Code | 首期开源支持 | 首期开源版本同步提供连接器、参考平台和完整桥接链路。 |
| Hermes | 首期开源支持 | 首期开源版本同步提供连接器、Profile 绑定流程和参考平台支持。 |
| OpenClaw | 首期开源支持 | 首期开源版本同步提供连接器、Agent 绑定流程和参考平台支持。 |

## SDK 能力

首期开源版本会同步提供两层 SDK 能力，但定位不同：

- `linco-bridge-connect/packages/connector-sdk`：可复用的 connector SDK，用于建立带认证的桥接 WebSocket 连接；
- `linco-bridge-platform/web/src/bridge/sdk`：可使用的 Bridge SDK / AgentChat SDK 参考实现，用于对接 reference platform 的 REST API 和桥接流程。

其中 connector SDK 更接近公共可复用能力；Web 侧 Bridge SDK / AgentChat SDK 当前更适合作为集成团队参考实现和二次开发基础。

## 项目边界

| 路径 | 适用用户 | 可用状态 |
| --- | --- | --- |
| Reference Web | 验证桥接链路的开发者 | 随开源版提供 |
| Linco App | 希望获得完整产品体验的用户 | 官方产品 |
| Protocol 集成 | 构建自有客户端的团队 | 随开源版提供 |
| Connector SDK | 需要可复用桥接连接能力的团队 | 随开源版提供 |
| Bridge SDK / AgentChat SDK | 需要对接参考平台或改造为自有客户端的团队 | 以可用参考实现形式随开源版提供 |
| 自托管 | 需要独立部署的团队 | 首期仅提供参考 / 开发验证能力，不作为生产部署指南 |

## 安全与隐私

- 不要将凭证提交到仓库或写入日志。
- TLS / WSS 传输加密本身不等同于端到端加密。
- 会话索引同步不等于完整消息历史上传。
- 连接真实数据前，请先阅读 [安全与隐私](docs/zh-CN/security-and-privacy.md)。
- 漏洞请按 [SECURITY.md](SECURITY.md) 私密报告。

## 文档

- [快速开始](docs/zh-CN/quick-start.md)
- [工作原理](docs/zh-CN/how-it-works.md)
- [CLI 命令参考](docs/zh-CN/cli.md)
- [公开协议](docs/zh-CN/protocol.md)
- [Reference Web](docs/zh-CN/reference-web.md)
- [支持平台](docs/zh-CN/supported-platforms.md)
- [安全与隐私](docs/zh-CN/security-and-privacy.md)
- [排障](docs/zh-CN/troubleshooting.md)
- [支持边界](SUPPORT.md)
- [参与贡献](CONTRIBUTING.md)

## 参与贡献

欢迎通过 Issue、Discussion 和 Pull Request 参与完善项目。贡献约定与问题报告方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。

MIT 许可证适用于本仓库中的代码和随附文档，但不自动授予 Linco 名称、Logo 或其他品牌资产的使用权；超出正常指代范围的品牌使用需单独获得许可。
