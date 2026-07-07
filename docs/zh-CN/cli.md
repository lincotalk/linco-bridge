# CLI 命令参考

[English](../cli.md)

| 命令 | 用途 |
| --- | --- |
| `linco-connect init` | 初始化凭证、Agent 类型、账号、channel 和连接覆盖配置。 |
| `linco-connect remove-account` | 删除某个 Agent 的已配置账号。 |
| `linco-connect delete-account` | `remove-account` 的同义命令。 |
| `linco-connect ws-prefix` | 为当前选定 channel 下的已配置账号写入或清除 `wsUrl` 覆盖。 |
| `linco-connect start` | 以前台方式启动本地桥接。 |
| `linco-connect start --daemon` | 在后台启动本地桥接。 |
| `linco-connect stop` | 停止本地桥接。 |
| `linco-connect reload` | 在支持的场景下重载运行时配置。 |
| `linco-connect status` | 显示版本和运行状态。 |
| `linco-connect doctor` | 检查本机环境、CLI 可用性和桥接相关配置。 |
| `linco-connect help` | 显示帮助信息。 |
| `linco-connect version` | 输出当前安装版本。 |

## 说明

- 普通输出和日志中不要显示完整 App Secret 或 Token。
- 实际运行行为会因 Agent 类型、channel 配置和本地操作环境而不同。
- 配置结构、环境变量和 Agent 适配细节请参考 [`linco-bridge-connect/README.md`](../linco-bridge-connect/README.md)。
