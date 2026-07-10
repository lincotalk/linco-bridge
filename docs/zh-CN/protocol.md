# Protocol 公开协议

[English](../protocol.md)

本页从仓库级别说明 Linco Bridge 的公开协议边界。它不替代连接器协议细则，但应该足以让仓库读者先理解桥接结构、消息分层以及允许二开的边界。

详细协议材料见：

- [连接器协议说明](../../linco-bridge-connect/docs/protocol.md)
- [连接器架构说明](../../linco-bridge-connect/docs/architecture.md)
- [参考平台 README](../../linco-bridge-platform/README.zh-CN.md)
- [Reference Web 说明](reference-web.md)

## 项目级模型

Linco Bridge 并不是定义了一套单一、统一的外部网络协议，而是由下面几层共同组成：

- 公共连接器运行时；
- 面向不同远端产品的 channel adapter；
- 开源参考平台通道 `linco-demo`；
- 消费桥接事件的前端 SDK 与 UI 流程。

也就是说，外部 channel payload 由各 adapter 自己负责；进入公共连接器后，才会统一成内部事件。

## 通道边界

| 通道 | 用途 | 位置 |
| --- | --- | --- |
| `linco` | 官方 Linco 产品通道 | `linco-bridge-connect/src/channel/linco/` |
| `linco-demo` | 开源参考平台通道 | `linco-bridge-connect/src/channel/lincoDemo/` + `linco-bridge-platform` |
| 自定义通道 | 第三方 H5、小程序、App、Web 或 IM 接入 | 新增 `src/channel/<name>/` 并注册 adapter |

`linco` 和 `linco-demo` 是两个独立 channel key。当前 demo 使用 Linco 兼容协议形态，但它可以在自己的 adapter 内独立演进。

## 核心消息族

从项目级视角看，最重要的协议消息可以分成三类：

| 方向 | 典型类型 | 含义 |
| --- | --- | --- |
| 客户端 → 连接器 | `inbound_message`、`permission_response`、`danger_confirm`、`stop_turn` | 用户输入和控制信号发送到本地连接器 |
| 连接器 → 客户端 | `turn_start`、`stream_chunk`、`tool_call`、`permission_request`、`outbound_message`、`turn_end` | Agent 进度、权限流转、文件返回和最终完成信号 |
| 本地命令结构化结果 | `slash_command_result` | 给项目列表、历史记录、模型设置、绑定操作等 UI 结构化展示使用 |

Linco Bridge 是事件驱动的。远端前端应把 `turn_end` 当作一次用户回合真正结束的信号。

## 流式回复与交互规则

Linco Bridge 面向的是比普通聊天更丰富的 Agent 交互：

- `stream_chunk` 支持过程流式输出和最终答案替换；
- `thinking`、`agent_task`、`agent_action` 可用于展示中间推理或结构化进度；
- `permission_request`、`danger_warning` 需要显式用户确认，除非当前审批模式改变了处理策略；
- 生成文件通常先以绝对路径 Markdown 引用展示，而不是直接把完整文件内容塞进消息协议。

因此，Linco Bridge 更适合被理解成 Agent 交互桥接层，而不是简单的消息转发器。

## 文件下发边界

推荐的生成文件链路是：

1. Agent 在回复中返回带绝对本机路径的 Markdown 文件引用；
2. 远端客户端把它渲染成可点击引用；
3. 用户点击或显式请求时，客户端再向连接器拉取文件；
4. 连接器在返回前校验路径、文件类型、是否隐藏、大小限制等条件。

默认应继续拦截 `.env`、`.git/config`、`.ssh/*` 等隐藏文件。

## 自定义接入规则

如果第三方要做自己的产品入口，推荐做法是：

- 保留公共连接器运行时；
- 新增自定义 channel adapter；
- 在 adapter 内定义产品自己的 payload 结构；
- 不修改官方 `linco` 通道行为。

涉及命令、payload、事件类型、路由或官方通道行为的二开 PR，必须遵循 [二次开发规则](secondary-development.md)。

## 本页不承诺什么

这个根级协议页不承诺：

- 所有 channel 都使用完全一致的前端 payload 结构；
- 参考平台协议永远冻结不变；
- 默认提供端到端加密；
- 对未发布 fork 或修改版客户端提供生产级兼容承诺。

精确字段结构、兼容性说明和 adapter 细节，请以详细协议文档为准。
