# 快速开始

[English](../quick-start.md)

Linco Bridge 有两条常见体验路径：

- **官方 Linco 通道（`linco`）：** 适合直接体验官方产品链路，不需要部署平台项目。
- **开源参考平台（`linco-demo`）：** 适合本地验证、私有化评估和二次开发，需要启动 `linco-bridge-platform`。

## 最小流程

官方通道通常只需要安装连接器、初始化凭证并启动：

```bash
npm install -g linco-connect
linco-connect init --token "<app-id>:<app-secret>" --agent codex
linco-connect start --daemon
```

开源参考平台请先启动后端和 H5，再在 H5 桥接页复制生成的 setup commands。命令会使用 `--channel linco-demo`，本地开发环境还会包含 `--allow-insecure-ws`。

## 详细文档

- [连接器安装、初始化和命令说明](../../linco-bridge-connect/README.zh-CN.md)
- [参考平台启动和 demo 凭证](../../linco-bridge-platform/README.md)
- [CLI 入口](cli.md)
- [排障](troubleshooting.md)

## 停止

```bash
linco-connect stop
```
