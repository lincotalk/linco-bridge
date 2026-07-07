# CLI 命令参考

[English](../cli.md)

根目录只保留项目级入口。`linco-connect` 的完整命令、配置、环境变量、斜杠命令和 Agent 适配说明请直接参考连接器项目文档：

- [Linco Connect README](../../linco-bridge-connect/README.zh-CN.md)
- [架构说明](../../linco-bridge-connect/docs/architecture.md)
- [协议说明](../../linco-bridge-connect/docs/protocol.md)
- [斜杠命令适配说明](../../linco-bridge-connect/docs/slash-commands.md)
- [安全说明](../../linco-bridge-connect/docs/security.md)

常用入口：

```bash
linco-connect init --token "<appId>:<appSecret>" --agent codex
linco-connect start --daemon
linco-connect doctor
linco-connect stop
```

使用开源参考平台时，初始化命令需要使用 `--channel linco-demo`；具体命令以 Reference Web 页面生成的 setup commands 为准。
