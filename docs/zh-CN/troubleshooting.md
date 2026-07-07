# 排障

[English](../troubleshooting.md)

## 未检测到设备

1. 确认 `linco-connect` 正在运行：`linco-connect status` 或 `linco-connect doctor`。
2. 检查 App ID、App Secret、Agent 类型、通道和账号是否与客户端页面一致。
3. 如果使用官方通道 `linco`，检查到官方 WSS 端点的网络连接。
4. 如果使用开源参考平台 `linco-demo`，确认 `linco-bridge-platform/server` 已启动并监听 `http://127.0.0.1:3300`。
5. 本地 `linco-demo` 使用 `ws://` 时，初始化命令需要包含 `--allow-insecure-ws`。
6. 分享日志前删除密钥、Token 和本地测试页访问地址。

## 参考平台 H5 检测失败

- 确认 H5 和 server 都已启动。
- 确认连接器初始化时使用 `--channel linco-demo`，而不是默认 `linco`。
- 确认所选 Agent 与凭证匹配，例如 Codex 使用 `demo-codex-app:demo-codex-secret`。
- 确认本地防火墙或代理没有拦截 `127.0.0.1:3300`。

## 凭证已占用

每套凭证通常只绑定一个桥接实例。停止或删除原桥接，或创建新凭证。

## 会话列表为空

- 确认所选本地 Agent 存在 session。
- 确认 Adapter 支持当前测试版本的 session 发现。
- 检查索引刷新是否失败或只返回部分数据。
- Hermes 和 OpenClaw 需要先完成 profile / agent 绑定后再继续验证。

## 提交 Issue 前

提供 Linco Connect 版本、操作系统、Node.js 版本、安装方式、Agent 及版本、通道名、复现步骤、预期与实际结果和脱敏日志。
