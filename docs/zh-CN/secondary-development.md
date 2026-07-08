# 二次开发规则

[English](../secondary-development.md)

本文说明团队在二次开发 Linco Bridge，并希望把代码推送回本仓库时需要遵循的规则。

## 接入边界

- 官方 `linco` 通道保留给官方 Linco 产品链路使用。
- 开源 `linco-demo` 通道是用于本地验证和二次开发的参考实现。
- 面向自有 H5、小程序、App、Web 或 IM 的产品集成，应在 `linco-bridge-connect/src/channel/<name>/` 下新增自定义 channel adapter，并通过 channel registry 注册。
- 不要把官方 `linco` 通道改造成第三方生产产品通道。可以改进共享协议工具，但官方通道行为必须继续兼容官方 Linco 客户端和服务。

## Pull Request 规则

- 涉及协议、命令行为、跨模块改动或官方通道行为的改动，开发前请先通过 Issue 或 Discussion 讨论。
- 保持 PR 范围清晰。产品专属 adapter 应与共享连接器、协议、服务端或 SDK 改动分开提交。
- 改动命令解析、协议映射、relay 行为或 channel 路由时，需要补充对应测试。
- 改动 payload、事件类型、命令或配置行为时，需要同步更新文档和兼容性说明。
- 不要提交 App Secret、Token、真实用户数据、生产端点凭证、私有日志或无授权素材。
- 未经维护者确认，不要修改 npm 包发布元数据、自更新逻辑、官方 WSS 默认地址或 release 自动化。

## 命令改动

`linco-bridge-connect/src/command/` 中的命令运行在用户电脑上。fork 可以改变安装该 fork 的用户的本地行为，但合入官方仓库的 PR 必须保证官方包用户的行为可预期。

- 不要削弱文件访问、附件下发、权限批准、危险操作确认、账号移除或进程控制相关安全检查。
- 除非已经接受迁移方案，否则保持现有命令语义向后兼容。
- 优先新增边界清晰的命令，而不是改变已有命令的含义。
- 如果命令输出会被前端或 relay 解析，用户可见输出变化应配套测试。

## 协议改动

协议映射是连接器、relay、SDK 和客户端之间的兼容契约。

- 服务端必须把连接器 frame 视为不可信输入。
- 尽量用向后兼容方式新增字段。接收方应忽略未知可选字段。
- 没有协议版本方案和 release note 时，不要重命名或移除现有事件类型和必填字段。
- 破坏性改动需要显式版本、能力标记、新事件类型或迁移期。
- 服务端改动必须基于已鉴权连接校验 `accountId`、`agentId`、`sessionKey`、`streamId`、payload 大小、文件元数据和事件状态。

## 自定义 Channel 建议

当接入有产品专属消息结构、凭证、路由、UI 事件或 IM 语义时，请使用自定义 channel。

推荐结构：

- 新增 `linco-bridge-connect/src/channel/<name>/`；
- 把协议转换限制在该 adapter 内；
- 需要时复用 `src/package/protocol` 中的共享 helper；
- 在 `linco-bridge-connect/test/channel/` 下补充聚焦测试；
- 为该 channel 写清楚初始化命令和安全边界。

## 评审标准

二开 PR 如果能回答这些问题，会更容易评审：

- 这个改动影响哪个 channel 或产品链路？
- 它影响官方 `linco`、`linco-demo`，还是只影响自定义 channel？
- 对现有 `linco-connect` 用户是否向后兼容？
- 服务端用什么校验来保护官方服务，避免被异常 fork 客户端影响？
- 哪些测试覆盖了命令、协议和 relay 行为？
