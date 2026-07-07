# 工作原理

[English](../how-it-works.md)

```text
本地 Agent
    ↕ 本地进程、Gateway 或 session 文件
用户电脑上的 linco-connect
    ↕ 已鉴权 WSS 连接
Reference Platform、兼容后端或 Linco Cloud
    ↕
Reference Web、Linco App 或第三方客户端
```

开源参考 platform 对应连接器插件中的 `linco-demo` 通道。它是一个可部署的示例，用来帮助团队获得比通用 IM 桥接更适合 Agent 的交互界面。你可以复用公共连接器和 Agent 适配层，同时基于自己的 H5、小程序、App 或其他前端形态实现新的 channel。

## 职责

- **本地 Agent：** 在用户电脑上执行提示词和工具。
- **linco-connect：** 适配 Agent、维护连接并转换 session 与事件。
- **Reference Platform / Server：** 校验设备、维护连接状态并转发消息。
- **Client / Channel 前端：** 展示会话、发送消息并呈现权限请求。

## 边界

- Reference Platform 用于开发和集成验证，不构成生产部署指南。
- TLS / WSS 保护传输，不代表已实现端到端加密。
- 同步会话索引不等于上传全部历史消息。
- 数据可见性、保留和删除策略取决于连接器、后端部署方式和客户端链路；连接真实数据前请先阅读安全与隐私文档。
