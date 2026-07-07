# 快速开始

[English](../quick-start.md)

## 前置条件

- 已支持的操作系统和 Node.js 版本。
- 至少已安装并正常运行一个已支持的本地 Agent CLI。
- 已在 Reference Web 或 Linco App 中创建凭证。

## 安装并连接

```bash
npm install -g linco-connect
linco-connect init --token "<app-id>:<app-secret>" --agent codex
linco-connect start --daemon
```

返回客户端，确认设备已在线，进入最近 session 并发送一条短测试消息。

如果使用 Hermes 或 OpenClaw，请在连接器上线后，根据客户端提示继续完成 profile 或 agent 绑定。

## 停止

```bash
linco-connect stop
```
