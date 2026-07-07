# 安全与隐私

[English](../security-and-privacy.md)

根目录只保留项目级安全边界。连接器侧的详细安全说明、附件规则、`/get` 文件下发限制、权限确认模式和本地模拟页注意事项，请参考：

- [连接器安全说明](../../linco-bridge-connect/docs/security.md)
- [Linco Connect README：安全注意](../../linco-bridge-connect/README.zh-CN.md#安全注意)
- [参考平台 README](../../linco-bridge-platform/README.md)
- [SECURITY.md](../../SECURITY.md)

## 项目级原则

- 不要提交 App Secret、Token、私钥、用户数据或带 token 的本地测试页地址。
- 官方通道、自托管参考平台和自定义 adapter 的数据可见性不同，连接真实数据前应审查实际链路。
- 本地 `linco-demo` 默认使用 `ws://127.0.0.1:3300`，只适合开发验证；公网部署应配置 TLS/WSS、鉴权、存储、审计和日志脱敏。
- TLS / WSS 不等于端到端加密。未针对实际链路完成实现与审查前，不宣称端到端加密、零知识或完全本地处理。
