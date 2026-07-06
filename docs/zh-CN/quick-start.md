# 快速开始

[English](../quick-start.md)

> 公开前必须使用最终发布版验证所有命令。

## 前置条件

- 已支持的操作系统和 Node.js 版本。
- Codex 或 Claude Code 已在本地正常运行。
- 已在 Reference Web 或 Linco App 中创建凭证。

## 安装并连接

```bash
npm install -g linco-connect
linco-connect init --token "<app-id>:<app-secret>" --agent codex --device-name codex1
linco-connect start --daemon
```

返回客户端，确认设备已在线，进入最近 session 并发送一条短测试消息。

## 停止

```bash
linco-connect stop
```

如最终命令、包名或流程变更，同步更新本文档、README、CLI `--help` 和 Demo。

