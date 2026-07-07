# Linco Connect

Linco Connect is a local Agent connector for Linco IM. It forwards IM messages to local Agent CLIs or gateways, then sends replies, tool events, permission requests, attachments, and generated file references back to IM.

Linco Connect 是运行在用户电脑上的本机 Agent 连接器，用于把 Linco IM 消息转发给本机 Agent CLI 或 Gateway，并把回复、工具调用、权限确认、附件和生成文件回传到 IM。

## Open-Source Positioning / 开源定位

Many Agent bridge projects integrate with existing collaboration platforms such as Feishu, WeChat, DingTalk, or similar IM products. That approach is easy to adopt, but the display and interaction model is usually constrained by the host platform, which can make tool progress, permission confirmation, generated files, and long-running Agent sessions feel fragmented.

Linco Connect is open-sourced together with a reference platform project. The reference platform corresponds to the `linco-demo` channel and shows one way to build a dedicated Agent interaction surface. You can deploy it first to experience the workflow, then implement your own H5, mini program, app, or other frontend channel with a matching channel adapter for a more personalized and comfortable experience.

很多 Agent 桥接项目会接入飞书、微信、钉钉等既有协作平台，这种方式接入成本低，但展示和交互形式受平台限制，工具进度、权限确认、生成文件和长会话体验往往不够舒适。

Linco Connect 会配套开源一个参考 platform 项目，对应插件里的 `linco-demo` 通道，用来展示如何构建更适合 Agent 的交互界面。你可以先部署参考实现体验完整流程，也可以基于自己的 H5、小程序、App 或其他前端形态实现新的 channel adapter，获得更个性化、更舒适的交互体验。

## Documentation

- [English](README.en-US.md)
- [简体中文](README.zh-CN.md)

## Developer Docs

English:

- [Architecture](docs/architecture.en-US.md)
- [Protocol](docs/protocol.en-US.md)
- [Slash commands](docs/slash-commands.en-US.md)
- [Security](docs/security.en-US.md)

简体中文：

- [架构说明](docs/architecture.md)
- [协议说明](docs/protocol.md)
- [斜杠命令适配说明](docs/slash-commands.md)
- [安全说明](docs/security.md)

## Local Simulator / 本地模拟页

The built-in local simulator is a browser-based IM debugging surface for connector development and self-testing. It is disabled by default, is not the `linco-demo` channel, is not a production Web service, and should not be exposed to the public internet.

插件内置的本地模拟页是用于连接器开发、自测和协议调试的浏览器 IM 调试界面。它默认关闭，不是开源 `linco-demo` 通道，也不是生产 Web 服务，不应暴露到公网。

Enable it explicitly when needed:

```bash
linco-connect start --local-im
```

The terminal prints a tokenized local URL. Open the full URL the first time; after a successful visit, the browser stores a local access cookie so refreshes keep working.

启动后终端会输出带访问 token 的本地测试页地址。首次打开请使用完整地址；访问成功后浏览器会保存本地访问 cookie，后续刷新或重新打开同源页面可以继续使用。不要把该地址或 token 发给不可信的人。
