# CLI 命令参考

[English](../cli.md)

本页从仓库级别总结 `linco-connect` 最常用的 CLI 入口，保证外部用户不跳转也能先看懂大致用法；完整语法和细节仍以连接器子项目文档为准。

完整命令、环境变量、斜杠命令和 Agent 适配细节见：

- [Linco Bridge connector README](../../linco-bridge-connect/README.zh-CN.md)
- [架构说明](../../linco-bridge-connect/docs/architecture.md)
- [协议说明](../../linco-bridge-connect/docs/protocol.md)
- [斜杠命令适配说明](../../linco-bridge-connect/docs/slash-commands.md)
- [连接器安全说明](../../linco-bridge-connect/docs/security.md)

## CLI 在做什么

`linco-connect` 运行在用户电脑上，用于把本地 Agent CLI 接到远端通道，转发消息、工具事件、权限确认、附件和生成文件引用。

最小使用流程通常是：

1. 初始化凭证和 Agent 类型；
2. 启动本地连接器服务；
3. 让远端页面检测到连接器；
4. 把远端会话桥接到本地 Agent。

## 常用生命周期命令

```bash
linco-connect init --token "<appId>:<appSecret>" --agent codex
linco-connect start --daemon
linco-connect doctor
linco-connect stop
```

相关命令说明：

| 命令 | 作用 |
| --- | --- |
| `linco-connect init` | 写入某个 Agent 账号的本地配置 |
| `linco-connect start` | 前台启动连接器 |
| `linco-connect start --daemon` | 后台启动连接器 |
| `linco-connect reload` | 热重载运行中服务的配置 |
| `linco-connect doctor` | 检查本机运行环境和 CLI 状态 |
| `linco-connect stop` | 停止后台服务 |
| `linco-connect remove-account` | 删除已配置的 Agent 账号 |

## 初始化方式

### 官方 Linco 通道

```bash
linco-connect init --token "<appId>:<appSecret>" --agent codex
```

如果你走的是官方产品链路，通常直接使用默认 `linco` 通道，不需要部署开源参考平台。

### 开源参考平台（`linco-demo`）

```bash
linco-connect init \
  --token "demo-codex-app:demo-codex-secret" \
  --agent codex \
  --channel linco-demo \
  --account codex_1 \
  --allow-insecure-ws
```

适用于本地联调、自托管体验和二次开发。因为本地默认桥接地址通常是 `ws://127.0.0.1:3300`，所以本地开发场景经常需要 `--allow-insecure-ws`。

### 官方在线 Demo

如果用户走的是在线 Demo，应该以 Bridge 页面生成的 `setupCommands` 为准。在线部署场景下，生成命令通常会自动带上 `--ws-url wss://.../bridge/ws/<agent>`。

## Agent 与会话能力

CLI 不只是安装入口，也承担运行期会话管理：

| 类别 | 典型能力 |
| --- | --- |
| 服务生命周期 | `start`、`stop`、`reload`、`doctor` |
| 账号管理 | `init`、`remove-account`、`delete-account` |
| 远端会话内本地斜杠命令 | `/help`、`/status`、`/approve`、`/get`、`/project`、`/history`、`/profile`、`/agent` |
| 版本维护 | `/update check`、`/update latest`、`/update <version>` |

在 Claude / Codex 流程里，连接器还可以列出项目、绑定已有会话、同步本地历史、生成 PC 端打开命令；在 Hermes / OpenClaw 流程里，则可以绑定后续新会话默认使用的 Profile 或 Agent。

## 审批与文件规则

如果用户只看安装命令，往往会忽略下面这些关键规则：

- `manual`、`auto`、`yolo` 三种审批模式会影响权限请求和危险操作的处理方式。
- `/get <路径>` 只应返回允许目录内、经过校验的非隐藏文件。
- 线上或公网部署应使用 `wss://`，`ws://` 只适合可信的本地开发环境。
- 本地凭证和连接器配置保留在用户电脑上，不应提交或分享。

## 何时查看详细文档

当你需要以下信息时，请继续查看连接器详细文档：

- 完整斜杠命令列表和结构化返回格式；
- `LINCO_<AGENT>_WS_URL` 等环境变量覆盖方式；
- `.linco/config.json` 的完整配置结构；
- Codex、Claude Code、Hermes、OpenClaw 的适配差异；
- 自更新、文件下发和安全边界的细节。
