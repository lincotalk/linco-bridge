# 工作原理

[English](../how-it-works.md)

```text
本地 Agent
    ↕ 本地进程、Gateway 或 session 文件
用户电脑上的 linco-connect
    ↕ 已鉴权 WSS 连接
Minimal Server 或 Linco Cloud
    ↕
Reference Web、Linco App 或第三方客户端
```

## 职责

- **本地 Agent：** 在用户电脑上执行提示词和工具。
- **linco-connect：** 适配 Agent、维护连接并转换 session 与事件。
- **Server：** 校验设备、维护连接状态并转发消息。
- **Client：** 展示会话、发送消息并呈现权限请求。

## 边界

- Minimal Server 是开发参考，不是生产自托管服务。
- TLS / WSS 保护传输，不代表已实现端到端加密。
- 同步会话索引不等于上传全部历史消息。
- 最终发布必须说明数据可见性、保留和删除。

