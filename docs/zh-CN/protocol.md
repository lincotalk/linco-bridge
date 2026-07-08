# Protocol 公开协议

[English](../protocol.md)

根目录协议文档只说明边界：Linco Bridge 的公开协议主要由连接器 channel adapter、参考平台 relay 和前端 SDK 共同体现。

详细协议请参考：

- [连接器协议说明](../../linco-bridge-connect/docs/protocol.md)
- [连接器架构说明](../../linco-bridge-connect/docs/architecture.md)
- [参考平台 README](../../linco-bridge-platform/README.md)
- [Reference Web 说明](reference-web.md)

## 项目级约定

- `linco` 是官方 Linco 产品通道。
- `linco-demo` 是开源参考平台通道，对应 `linco-bridge-platform`。
- 第三方要做自己的 H5、小程序、App、Web 或 IM 入口时，应新增自己的 channel adapter，而不是修改官方 `linco` 通道。
- 协议 payload、事件字段和兼容性说明应以连接器子项目文档和 release notes 为准。
- 涉及命令、协议 payload、事件类型、channel 路由或官方通道行为的二开 PR，必须遵循 [二次开发规则](secondary-development.md)。
