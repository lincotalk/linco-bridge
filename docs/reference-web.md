# Reference Web

[简体中文](zh-CN/reference-web.md)

Reference Web is the H5 client in `linco-bridge-platform/web`. It validates the complete `linco-demo` bridge flow and provides a base for custom clients.

It is not the official Linco App and not a WeChat mini program by itself. Its value is to provide a deployable, observable, and customizable Agent interaction reference. If existing IM products such as Feishu, WeChat, or DingTalk do not fit tool progress, permission confirmations, file delivery, or long-running sessions well, teams can use it as a base for their own H5 page, mini program, app, or other frontend.

## Included

- Select a supported agent.
- Generate visitor-scoped `linco-connect` setup commands and detect connector status.
- Bind a Hermes profile or OpenClaw agent where the selected local tool requires it.
- Synchronize, browse, search, and open supported Agent sessions.
- Present streaming output, permission requests, attachments, and generated files.
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
