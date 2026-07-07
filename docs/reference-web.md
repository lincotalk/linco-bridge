# Reference Web

[简体中文](zh-CN/reference-web.md)

Reference Web is the open H5 client in `linco-bridge-platform/web`. It validates the full Linco Connect to local Agent flow. It belongs to the open reference platform and maps to the connector plugin's `linco-demo` channel.

It is not the official Linco App and not a WeChat mini program by itself. Its value is to provide a deployable, observable, and customizable Agent interaction reference. If existing IM products such as Feishu, WeChat, or DingTalk do not fit tool progress, permission confirmations, file delivery, or long-running sessions well, teams can use it as a base for their own H5 page, mini program, app, or other frontend.

## Included

- Select a supported agent.
- Display or use credentials issued or seeded by the reference platform.
- Generate and copy `linco-connect` installation, initialization, and startup commands.
- Detect the local connector online state through the `linco-demo` channel.
- Bind a Hermes profile or OpenClaw agent where the selected local tool requires it.
- Synchronize, browse, and search the session index where supported by the selected flow.
- Open a session and perform bridge validation testing.
- Present reference interactions for streaming output, permission requests, attachments, and generated file delivery.
- Provide a reference for custom channel UI, REST APIs, and protocol adaptation.

## Not Included

- Full Linco App messaging and collaboration.
- Official hosted-service code.
- Production-grade login, JWT, multi-tenant, device-management, and audit capabilities.
- A production self-hosted control plane or operations guide.

## Secondary Development Directions

- Keep the `linco-bridge-connect` Agent adapter layer and replace the frontend interaction model.
- Reuse the Bridge SDK / AgentChat SDK ideas in `linco-bridge-platform/web/src/bridge/sdk` while connecting to your own backend.
- Add a connector channel adapter instead of modifying the official `linco` channel directly.
