# Linco Connect

[English](README.md)

> 通过开放桥接层，将本地 AI 工具连接到 Web、移动端和 IM 产品。

**项目状态：** Open Source Alpha。接口、兼容性和文档仍可能变化，Stable、Experimental 和 Planned 能力将分开标识。

## 为什么做 Linco Connect

本地 AI 工具很强大，但会话通常停留在一台电脑上。很多桥接项目会接入飞书、微信、钉钉等既有协作平台，这种方式接入成本低，但展示和交互形式受平台限制，工具进度、权限确认、生成文件、长会话和多 Agent 状态往往很难做出舒适体验。

Linco Connect 提供一层开放、可控的桥接能力，让本地 Agent 可以在其他产品入口中使用。仓库同时包含一个参考 platform 项目，对应连接器插件里的 `lincoDemo` 通道，用来展示一套更适合 Agent 的交互界面。你可以先部署参考实现体验完整流程，也可以基于自己的 H5、小程序、App 或其他前端形态实现新的 channel adapter，获得更个性化、更舒适的交互体验。

- 使用参考 platform / Reference Web 验证完整连接链路。
- 将 Protocol 和 Adapter 集成到自有 H5、小程序、App 或 IM 产品。
- 通过 Linco App 或官方 Linco 通道获得完整官方产品体验。

## 支持工具

| 工具 | 状态 | 说明 |
| --- | --- | --- |
| Codex | 稳定首发目标 | 发布前补充实际测试版本与操作系统。 |
| Claude Code | 稳定首发目标 | 发布前补充实际测试版本与操作系统。 |
| OpenClaw | Experimental / Planned | 仅在完成基础兼容验证后发布。 |
| Hermes | Experimental / Planned | 仅在完成基础兼容验证后发布。 |

## 快速开始

> 本草稿中的命令必须与最终发布物完成一次回归后再公开。

```bash
npm install -g linco-connect

linco-connect init \
  --token "<app-id>:<app-secret>" \
  --agent codex

linco-connect start --daemon
```

继续阅读 [快速开始](docs/zh-CN/quick-start.md)，完成凭证创建、连接检测、进入 session 和发送测试消息。

## 工作方式

```text
Codex / Claude Code / 其他本地 Agent
                    ↕
              linco-connect
                    ↕
       Reference Platform 或 Linco Cloud
                    ↕
       Reference Web / Linco App / 第三方应用
```

`linco-connect` 运行在用户电脑上，将本地 Agent 连接到兼容的服务端和客户端。公开文档需说明哪些元数据、会话索引、消息、文件和日志会离开电脑，以及如何保留和删除。

## 使用方式

| 路径 | 适用用户 | 可用状态 |
| --- | --- | --- |
| Reference Platform / Reference Web | 验证桥接链路或构建自定义体验的开发者 | 随开源版提供 |
| 自定义 channel adapter | 构建自有 H5、小程序、App 或 IM 客户端的团队 | 随开源协议和连接器提供 |
| Linco App / 官方 Linco 通道 | 希望获得完整官方产品体验的用户 | 官方产品 |
| Protocol 集成 | 构建自有客户端或服务端的团队 | 随开源版提供 |
| SDK | 需要高层封装的集成团队 | 仅在标记 Released 时可用，否则为 Planned |
| 自托管 | 需要独立部署的团队 | 首期仅最小开发验证，生产参考部署见 Roadmap |
| 官方 Web / 小程序 | 不希望部署的用户 | Planned，上线前不放置无效链接 |

## 安全与隐私

- 不得将凭证提交到仓库或写入日志。
- TLS / WSS 等传输加密不等同于端到端加密。
- 会话索引不等同于完整消息历史。
- 连接真实数据前请阅读 [安全与隐私](docs/zh-CN/security-and-privacy.md)。
- 漏洞请按 [SECURITY.md](SECURITY.md) 私密报告。

## 文档

- [快速开始](docs/zh-CN/quick-start.md)
- [工作原理](docs/zh-CN/how-it-works.md)
- [CLI 命令参考](docs/zh-CN/cli.md)
- [Protocol 公开协议](docs/zh-CN/protocol.md)
- [Reference Web](docs/zh-CN/reference-web.md)
- [支持平台](docs/zh-CN/supported-platforms.md)
- [安全与隐私](docs/zh-CN/security-and-privacy.md)
- [排障](docs/zh-CN/troubleshooting.md)
- [支持边界](SUPPORT.md)
- [参与贡献](CONTRIBUTING.md)

## 我们的团队

Linco 聚集了一群对 AI 保持热爱、好奇并愿意动手实现想法的产品创造者与 AI 原生开发者。我们关注 AI 如何改变软件、沟通与协作方式，并尝试把这些变化做成真正可使用的产品。

无论你是专业开发者、产品设计者、独立创造者、正在边学边做的 AI 原生程序员，还是在为个人项目、公司团队或创业想法寻找新可能，都欢迎加入 Linco 产品社区。在这里，你可以讨论 Linco 产品、AI Agent、开源集成、工作流、创意原型与创业实践，也可以通过 Issue、Discussion 和 Pull Request 一起完善 Linco Connect。

## 许可证

法务与专利评审完成后，在此填入最终许可证名称和链接。开源许可证不自动授权 Linco 名称和 Logo；品牌规则将在审批后另行公布。
