# 排障

[English](../troubleshooting.md)

## 未检测到设备

1. 确认 `linco-connect` 正在运行。
2. 检查 App ID、App Secret、Agent 类型和设备名。
3. 检查到已配置 WSS 端点的网络连接。
4. 分享日志前删除密钥。

## 凭证已占用

每套凭证只绑定一个桥接实例。停止或删除原桥接，或创建新凭证。

## 会话列表为空

- 确认所选本地 Agent 存在 session。
- 确认 Adapter 支持当前测试版本的 session 发现。
- 检查索引刷新是否失败或只返回部分数据。

## 提交 Issue 前

提供 Linco Connect 版本、操作系统、安装方式、Agent 及版本、复现步骤、预期与实际结果和脱敏日志。

