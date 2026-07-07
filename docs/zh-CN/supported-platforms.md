# 支持平台

[English](../supported-platforms.md)

本页只说明项目级发布范围。Agent 精确验证版本、Node.js 兼容性、操作系统注意事项和已知限制，请以连接器子项目 README 与 release notes 为准。

## 项目级范围

| 类别 | 首期范围 | 详细文档 |
| --- | --- | --- |
| Agent | Codex CLI、Claude Code、Hermes、OpenClaw | [连接器 README](../../linco-bridge-connect/README.zh-CN.md) |
| 官方通道 | `linco` | [连接器配置说明](../../linco-bridge-connect/README.zh-CN.md#配置) |
| 开源参考通道 | `linco-demo` | [参考平台 README](../../linco-bridge-platform/README.md) |
| 自定义通道 | 可通过新增 channel adapter 扩展 | [连接器架构说明](../../linco-bridge-connect/docs/architecture.md) |

## 发布规则

- 保持根 README、子项目 README、Release Notes 和兼容性说明一致。
- 完成实际验证后，在 Release 中公布精确测试版本、操作系统和已知限制。
- 如果某个 Agent、Node.js 版本或操作系统存在限制，请在 Release Notes 和排障文档中明确写出。
