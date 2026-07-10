# 快速开始

[English](../quick-start.md)

Linco Bridge 有三种常见体验入口：

- **官方产品路径（Linco App）：** 适合直接体验官方产品链路，不需要部署平台项目。
- **开源参考平台（本地部署）：** 适合本地验证、私有化评估和二次开发，需要启动 `linco-bridge-platform`。
- **官方在线 Demo：** 属于开源参考平台的托管体验入口，适合快速试用桥接流程。

## 最小流程

官方通道通常只需要安装连接器、初始化凭证并启动：

```bash
npm install -g linco-connect
linco-connect init --token "<app-id>:<app-secret>" --agent codex
linco-connect start --daemon
```

开源参考平台请先启动后端，并确认 `http://127.0.0.1:3300/api/demo-config` 可访问；然后再启动 H5。打开 H5 开发地址后，进入 **桥接 → 从 Codex 导入**，复制页面生成的 setup commands。命令会使用 `--channel linco-demo`，本地开发环境还会包含 `--allow-insecure-ws`。

若要直接使用官方在线 Demo，打开 [https://bridge-demo.lincotalk.com](https://bridge-demo.lincotalk.com)；若要自行部署（H5 / 小程序 + 用户本机 connector），见 [在线 Demo 部署指南](deploy-demo.md)。

## 详细文档

- [连接器安装、初始化和命令说明](../../linco-bridge-connect/README.zh-CN.md)
- [参考平台启动和 demo 凭证](../../linco-bridge-platform/README.md)
- [CLI 入口](cli.md)
- [排障](troubleshooting.md)

## 停止

```bash
linco-connect stop
```
