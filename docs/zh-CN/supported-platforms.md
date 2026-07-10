# 支持平台

[English](../supported-platforms.md)

本页从仓库级别总结当前首发版本的兼容范围。它不替代子项目的详细 release notes，但应该让外部体验者先快速理解：现在到底支持哪些 Agent、需要哪些运行环境、哪些内容在首发范围内。

详细参考：

- [连接器 README](../../linco-bridge-connect/README.zh-CN.md)
- [平台 README](../../linco-bridge-platform/README.zh-CN.md)
- [排障文档](troubleshooting.md)
- [CHANGELOG](../../CHANGELOG.md)

## 运行环境要求

| 项 | 当前建议 |
| --- | --- |
| Node.js | Node.js 20+；推荐 Node.js 22 LTS |
| 本地连接器包 | `linco-connect` |
| 支持的本地 Agent | Codex CLI、Claude Code、Hermes、OpenClaw |
| 参考平台后端 | `linco-bridge-platform/server` |
| 参考平台前端 | `linco-bridge-platform/web` |

## 已验证 Agent 版本

当前文档给出的验证版本集为：

| Agent | 已验证版本 | 说明 |
| --- | --- | --- |
| Codex CLI | `codex-cli 0.142.5` | 默认使用 app-server 模式 |
| Claude Code | `2.1.198 (Claude Code)` | 使用 stream-json 与 stdio 权限确认 |
| Hermes | `Hermes Agent v0.13.0 (2026.5.7)` | 支持 Profile 列表与绑定 |
| OpenClaw | `OpenClaw 2026.5.18 (50a2481)` | 支持 Agent 列表与绑定 |

## 项目级范围

| 类别 | 首期范围 | 详细文档 |
| --- | --- | --- |
| Agent | Codex CLI、Claude Code、Hermes、OpenClaw | [连接器 README](../../linco-bridge-connect/README.zh-CN.md) |
| 官方通道 | `linco` | [连接器配置说明](../../linco-bridge-connect/README.zh-CN.md#配置) |
| 开源参考通道 | `linco-demo` | [参考平台 README](../../linco-bridge-platform/README.zh-CN.md) |
| 自定义通道 | 可通过新增 channel adapter 扩展 | [连接器架构说明](../../linco-bridge-connect/docs/architecture.md) |

## 仓库当前覆盖的前端形态

当前仓库支持或给出参考的前端形态包括：

- 通过 `linco` 通道接入官方 Linco 产品链路；
- 通过 `linco-demo` 体验本地或在线 H5 参考流程；
- 由参考 Web 工程构建出的微信小程序产物；
- 基于新 channel adapter 扩展出的自定义 H5、小程序、App、Web 或 IM 入口。

但仓库 **不包含** 覆盖所有前端形态的完整生产控制台。

## 当前范围限制

- 开源参考平台主要用于体验、联调和二次开发参考，不是开箱即用的生产托管方案。
- 在线 Demo 可能会为了降低体验门槛而牺牲部分隔离性或持久化能力。
- 兼容性应理解为“按版本验证”，不是永久不变。Agent、操作系统或 Node.js 大版本变化后，可能需要重新验证。

## 发布规则

- 保持根 README、子项目 README、Release Notes 和兼容性说明一致。
- 完成实际验证后，在 Release 中公布精确测试版本、操作系统和已知限制。
- 如果某个 Agent、Node.js 版本或操作系统存在限制，请在 Release Notes 和排障文档中明确写出。
