# Reference Web

[English](../reference-web.md)

Reference Web 是 `linco-bridge-platform/web` 中的 H5 客户端，用于验证完整的 `linco-demo` 桥接链路，也可作为自定义客户端的开发参考。

它不是官方 Linco App，也不是微信小程序本体。它的价值是给团队一套可部署、可观察、可改造的 Agent 交互参考：如果飞书、微信、钉钉等既有 IM 的展示结构不适合工具进度、权限确认、文件下发或长会话，可以基于它继续二开 H5、小程序、App 或其他前端形态。

## 包含

- 选择已支持 Agent。
- 生成访客专属的 `linco-connect` 连接命令并检测连接器状态。
- 在所选本地工具需要时完成 Hermes profile 或 OpenClaw agent 绑定。
- 同步、浏览、搜索和打开已支持的 Agent 会话。
- 展示流式输出、权限请求、附件和生成文件。
- 为自定义 channel UI、REST API 和协议适配提供参考。

## 不包含

- Linco App 完整 IM 和协作能力。
- 官方托管服务代码。
- 生产级登录、JWT、多租户、设备管理和审计能力。
- 生产可用的自托管控制面或运维方案。

## 二次开发方向

- 保留 `linco-bridge-connect` 的 Agent 适配层，只替换前端交互。
- 复用 `linco-bridge-platform/web/src/bridge/sdk` 中的 Bridge SDK / AgentChat SDK 思路，接入自己的后端。
- 新增连接器 channel adapter，而不是直接修改官方 `linco` 通道。
