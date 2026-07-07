# CLI 命令参考

[English](../cli.md)

> 后端负责人需基于最终 CLI `--help` 输出替换本草稿。

| 命令 | 用途 |
| --- | --- |
| `linco-connect init` | 初始化凭证、Agent 类型、通道和账号。 |
| `linco-connect start --daemon` | 在后台启动本地桥接。 |
| `linco-connect stop` | 停止本地桥接。 |
| `linco-connect status` | 如已实现，显示版本和连接状态。 |

设备标识在运行时生成。如需覆盖展示名称，可使用 `LINCO_DEVICE_NAME` 环境变量或配置中的 `device.name`。

普通输出和日志不得显示完整 App Secret 或 Token。发布前补齐配置路径、环境变量覆盖、退出码、升级和卸载行为。

