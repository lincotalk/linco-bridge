<p align="center">
  <img src="docs/images/readme-logo-temp.png" alt="Linco Bridge logo" width="140" />
</p>

<h1 align="center">Linco Bridge</h1>

<p align="center">
  一个开放的桥接层，用来把运行在个人电脑上的 AI Agent 工具连接到
  Web、H5、小程序、App、IM 或其他客户端。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-open%20source%20alpha-0f766e" alt="status: open source alpha" />
  <img src="https://img.shields.io/badge/agents-Codex%20%7C%20Claude%20%7C%20Hermes%20%7C%20OpenClaw-2563eb" alt="supported agents" />
  <img src="https://img.shields.io/badge/channel-official%20%2B%20reference%20platform-f59e0b" alt="channel types" />
  <img src="https://img.shields.io/badge/license-MIT-111827" alt="license: MIT" />
</p>

**项目状态：** Open Source Alpha。接口、兼容性和文档仍可能变化；首期开源版本聚焦于可运行的本地连接器、可部署的参考平台通道，以及 Codex CLI、Claude Code、Hermes、OpenClaw 四类 Agent 的桥接验证。

<p align="center">
  <a href="https://testflight.apple.com/join/Ahm1encB">📱 iOS 下载</a>
  ·
  <a href="https://www.lincotalk.com/download/apk/linco.apk">🤖 Android 下载</a>
  ·
  <a href="https://bridge-demo.lincotalk.com">🌐 在线 Demo</a>
  ·
  <a href="docs/media/linco-bridge-demo.mp4">▶ Watch Demo</a>
  ·
  <a href="docs/zh-CN/quick-start.md">📘 快速开始</a>
  ·
  <a href="COMMUNITY.zh-CN.md">💬 社区</a>
  ·
  <a href="README.md">🌐 English</a>
</p>

![Linco Bridge 主视觉预览](docs/images/demo/linco-bridge-hero.png)

## ✨ 亮点

| 本地优先桥接 | 更适合 Agent 的交互形态 | 开放扩展面 |
| --- | --- | --- |
| Agent CLI 继续运行在用户自己的电脑上，同时把会话、附件和生成文件桥接到远端客户端。 | 不把长流程 Agent 工作强行塞进通用 IM 里，而是用参考 Web / App 形态验证更舒服的交互方式。 | 复用连接器、协议工具和 channel adapter 机制，搭建自己的 H5、小程序、App、Web 或 IM 入口。 |

## 🧭 项目概览

本地 AI Agent 工具很强大，但会话、工具执行和生成文件通常停留在一台电脑上。很多桥接项目会接入飞书、微信、钉钉等既有 IM 或协作平台，这种方式接入成本低，但展示和交互形式受平台限制：工具进度、权限确认、生成文件、长会话、多 Agent 状态和会话恢复很难做出足够舒适的体验。

Linco Bridge 的目标不是把所有人都绑定到某个 IM，而是提供一套开放思路和参考实现：

- 通过本地连接器插件把 PC 上的 Agent CLI 桥接出来；
- 通过开源参考平台快速部署一条可体验的 `linco-demo` 通道；
- 通过官方 Linco 通道直接体验完整产品链路；
- 基于公开协议、SDK 和 channel adapter 机制，二开自己的 H5、小程序、App、Web 或 IM 入口。

## 📦 仓库包含什么

这个仓库包含两个可运行子项目和项目级文档：

- `linco-bridge-connect`：本地连接器 / 插件项目，运行在用户电脑上，负责连接本地 Agent CLI，并把消息、权限请求、附件和生成文件中继到远端通道；
- `linco-bridge-platform`：开源参考平台通道，包含 NestJS 后端和 UniApp 前端，用于快速自托管体验 `linco-demo` 流程，也可作为二次开发 H5、小程序或 App 的参考；
- `docs/`：项目级文档，覆盖快速开始、工作原理、协议、安全、支持范围和排障。

这个仓库 **不包含** 完整的 Linco App 产品本体，也不包含官方托管云服务代码。官方 Linco 通道是产品体验入口；开源 `linco-demo` 通道是可部署、可改造的参考实现。

## 🔄 工作流程

```text
本地 Agent CLI
    ↕ 本地进程、Gateway 或会话文件
linco-bridge-connect（运行在用户电脑上）
    ↕ 已鉴权 WebSocket 桥接连接
官方 Linco 通道、开源 Reference Platform 或兼容后端
    ↕
Linco App、Reference Web、自定义 H5/小程序/App/IM 客户端
```

`linco-bridge-connect` 负责适配本地 Agent，并把会话、消息、权限请求、附件和生成文件中继到兼容产品中。`linco-bridge-platform` 提供一套可本地部署的后端和 H5 体验，方便验证完整链路，也方便团队在此基础上改造自己的交互体验。

## 🏗️ 架构速览

| 层次 | 作用 |
| --- | --- |
| `linco-bridge-connect` | 运行在用户电脑上，连接本地 Agent CLI，并转发消息、权限、文件和会话状态。 |
| Bridge backend / channel | 负责设备鉴权、桥接会话维护，以及对外提供 API 或 WebSocket 能力。 |
| Client surface | 可以是官方 Linco 体验、开源参考平台，也可以是自定义 H5 / App / 小程序 / IM 客户端。 |

## 🚀 推荐使用路径

| 路径 | 适合谁 | 说明 |
| --- | --- | --- |
| 官方产品路径（Linco App） | 想以最低门槛体验官方 Linco 产品链路的用户 | 通常使用 Linco App 配合连接器即可。底层对应的官方 channel key 是 `linco`，但普通用户不需要关心这个技术名词。 |
| 开源参考平台路径（`linco-demo`） | 想做本地验证、自部署评估或研究实现的团队 | 既可以本地启动 `linco-bridge-platform/server + web`，也可以直接使用官方在线 Demo；两者都属于开源参考平台路径。 |
| 自定义扩展路径 | 想构建自己交互入口的产品或工程团队 | 复用连接器和 Agent 适配层，新增自己的 H5、小程序、App、Web 或 IM channel adapter。 |

## ⚡ 快速开始

### 方式一：官方产品路径（Linco App）

官方产品路径通常配合 Linco App 使用：

- iOS (TestFlight): [https://testflight.apple.com/join/Ahm1encB](https://testflight.apple.com/join/Ahm1encB)
- Android: [https://www.lincotalk.com/download/apk/linco.apk](https://www.lincotalk.com/download/apk/linco.apk)

安装本地连接器：

```bash
npm install -g linco-connect
```

用官方产品路径签发的凭证初始化：

```bash
linco-connect init \
  --token "<app-id>:<app-secret>" \
  --agent codex
```

启动连接器：

```bash
linco-connect start --daemon
```

然后打开 Linco App 或其他兼容的官方客户端，确认设备上线，进入会话并发送测试消息。

### 方式二：开源参考平台（本地部署）

先启动参考平台后端：

```bash
cd linco-bridge-platform/server
npm install
npm run start:dev
```

确认后端可用：

```bash
curl http://127.0.0.1:3300/api/demo-config
```

然后启动 H5 前端：

```bash
cd linco-bridge-platform/web
npm install
npm run dev:h5
```

打开 `npm run dev:h5` 输出的本地 H5 地址，然后按下面流程操作：

1. 进入 **桥接** Tab；
2. 点击 **从 Codex 导入**；
3. 复制页面生成的 `setupCommands`；
4. 在本机终端执行这些命令；
5. 回到页面点击 `我已复制，获取连接状态`；
6. 等待页面确认连接成功；
7. 点击 `进入 Codex` 进入聊天页；
8. 如需选择项目、进入已有会话或新建会话，可点击右上角文件夹图标。

完整流程见 [快速开始](docs/zh-CN/quick-start.md)、[平台 README](linco-bridge-platform/README.zh-CN.md)、[平台 Server README](linco-bridge-platform/server/README.zh-CN.md) 和 [Web / H5 README](linco-bridge-platform/web/README.zh-CN.md)。

### 方式三：使用官方在线 Demo

这是开源参考平台路径下的托管体验入口，适合想快速试用桥接流程、但不想本地启动 `server + web` 的用户。

如果希望通过官方托管体验快速试用 Linco Bridge：

1. 打开 [https://bridge-demo.lincotalk.com](https://bridge-demo.lincotalk.com)；如果使用小程序，可直接搜索入口或扫码进入。当前小程序版本默认使用**扫码登录**；
2. 进入页面后打开 **桥接**；
3. 点击 **从 Codex 导入**；
4. 复制页面生成的 `setupCommands`；
5. 在本机终端执行这些命令；
6. 回到页面点击 **我已复制，获取连接状态**；
7. 等待页面确认连接成功；
8. 点击 **进入 Codex** 进入聊天页；
9. 如需选择项目、进入已有会话或新建会话，点击右上角文件夹图标；
10. 发送一条测试消息，确认整条桥接链路已打通。

在线 Demo 主要用于轻量公开体验，不提供正式账号体系。Demo 状态通常通过匿名访客 ID 与浏览器本地缓存做隔离；如果清理浏览器缓存、更换设备或使用无痕模式，本地 Demo 历史记录和状态可能丢失。

请不要在在线 Demo 中输入敏感信息、长期保存数据或正式业务数据。

部署说明见 [在线 Demo 部署指南](docs/zh-CN/deploy-demo.md)。

## 🤖 支持的 Agent

| Agent | 首期状态 | 当前子项目文档中的验证版本 |
| --- | --- | --- |
| Codex CLI | 支持 | `codex-cli 0.142.5` |
| Claude Code | 支持 | `2.1.198 (Claude Code)` |
| Hermes | 支持 | `Hermes Agent v0.13.0 (2026.5.7)` |
| OpenClaw | 支持 | `OpenClaw 2026.5.18 (50a2481)` |

精确兼容性以后续 release notes 和各子项目 README 为准。

## 🧩 SDK 与扩展点

- `linco-bridge-connect/src/package/connector`：可复用的 connector SDK，用于建立带认证的桥接 WebSocket 连接；
- `linco-bridge-connect/src/package/protocol`：连接器侧的消息、文件和 channel 规范化工具；
- `linco-bridge-platform/web/src/bridge/sdk`：Bridge SDK / AgentChat SDK 参考实现，用于对接参考平台 REST API 和桥接流程；
- `linco-bridge-connect/src/channel/`：channel adapter 扩展点。`linco` 是官方通道，`linco-demo` 是开源参考平台通道，第三方应新增自己的 channel 目录并注册 adapter。

自定义 channel、命令改动、协议兼容和二开 PR 的规则见 [二次开发规则](docs/zh-CN/secondary-development.md)。

## 📌 项目边界

| 能力 | 开源仓库是否包含 |
| --- | --- |
| 本地连接器插件 | 是 |
| 开源参考平台通道 | 是 |
| Reference Web / H5 体验 | 是 |
| 官方 Linco App 完整产品 | 否 |
| 官方托管云服务代码 | 否 |
| 生产级自托管运维指南 | 否，当前以开发验证和二次开发参考为主 |

## 🔐 安全与隐私

- 不要将 App Secret、Token 或私钥提交到仓库或写入日志。
- 本地 `linco-demo` 使用 `ws://127.0.0.1:3300`，仅用于本机开发验证；公网部署应配置 TLS/WSS 和自己的鉴权、存储、审计策略。
- TLS / WSS 传输加密本身不等同于端到端加密。
- 会话索引同步不等于完整消息历史上传。
- 连接真实数据前，请先阅读 [安全与隐私](docs/zh-CN/security-and-privacy.md)。
- 漏洞请按 [SECURITY.md](SECURITY.md) 私密报告。

## 📚 文档

- [快速开始](docs/zh-CN/quick-start.md)
- [在线 Demo 部署](docs/zh-CN/deploy-demo.md)
- [工作原理](docs/zh-CN/how-it-works.md)
- [CLI 命令参考](docs/zh-CN/cli.md)
- [公开协议](docs/zh-CN/protocol.md)
- [二次开发规则](docs/zh-CN/secondary-development.md)
- [Reference Web](docs/zh-CN/reference-web.md)
- [支持平台](docs/zh-CN/supported-platforms.md)
- [安全与隐私](docs/zh-CN/security-and-privacy.md)
- [排障](docs/zh-CN/troubleshooting.md)
- [连接器 README](linco-bridge-connect/README.zh-CN.md)
- [参考平台 README](linco-bridge-platform/README.zh-CN.md)
- [参考平台 Server README](linco-bridge-platform/server/README.zh-CN.md)
- [参考平台 Web / H5 README](linco-bridge-platform/web/README.zh-CN.md)
- [支持边界](SUPPORT.md)
- [参与贡献](CONTRIBUTING.md)

## 💬 社区与动态

Linco Bridge 是开源项目，我们也维护一些社区入口，用来承载更开放的交流内容，包括 AI coding、前沿 AI 资讯、Agent 工作流、桥接集成，以及产品实践相关讨论。

### 技术交流群

欢迎加入微信技术交流群，讨论接入问题、产品反馈、AI coding 实践和 Agent 工作流想法：

<img src="docs/images/community-wechat-group.jpg" alt="Linco technical WeChat group" width="360" />

说明：微信群二维码可能会过期。如果二维码失效，请以本仓库中的最新社区信息或 Linco 官方渠道公告为准。

### Linco Lab 内容渠道

关注 **Linco Lab**，获取开源更新、AI coding 笔记、桥接集成案例、Agent 工作流内容，以及更广泛的前沿 AI 观察。

- 小红书：[Linco Lab](https://xhslink.com/m/7tdp7JOYViz)
- 微信公众号：微信内搜索 `Linco Lab`

<img src="docs/images/linco-lab-wechat-official-account.jpg" alt="Linco Lab WeChat Official Account QR code" width="220" />

### Linco App 下载

如需体验完整的官方产品能力，可以下载 Linco App：

- iOS (TestFlight): [https://testflight.apple.com/join/Ahm1encB](https://testflight.apple.com/join/Ahm1encB)
- Android: [https://www.lincotalk.com/download/apk/linco.apk](https://www.lincotalk.com/download/apk/linco.apk)

更完整的社区说明见 [COMMUNITY.zh-CN.md](COMMUNITY.zh-CN.md)。如需英文版社区页，可查看 [COMMUNITY.md](COMMUNITY.md)。

## 🤝 参与贡献

欢迎通过 Issue、Discussion 和 Pull Request 参与完善项目。贡献约定与问题报告方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## ⚖️ 许可证

本项目基于 [MIT License](LICENSE) 开源。

MIT 许可证适用于本仓库中的代码和随附文档，但不自动授予 Linco 名称、Logo 或其他品牌资产的使用权；超出正常指代范围的品牌使用需单独获得许可。
