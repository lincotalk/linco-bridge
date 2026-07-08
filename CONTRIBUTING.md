# Contributing / 参与贡献

Thank you for helping improve Linco Bridge. / 感谢你帮助改进 Linco Bridge。

## Before opening an issue / 提交 Issue 前

1. Search existing issues and discussions. / 搜索已有 Issue 和 Discussion。
2. Reproduce on a supported or latest available version. / 在已支持或最新版本复现。
3. Include OS, installation method, agent and version, steps, expected behavior, actual behavior, and redacted logs. / 提供系统、安装方式、Agent 版本、步骤、预期 / 实际结果与脱敏日志。
4. Report security issues privately according to `SECURITY.md`. / 安全问题按 `SECURITY.md` 私密报告。

## Pull requests

- Discuss protocol changes, cross-module work, and large features before implementation.
- Keep each PR focused and explain user-visible behavior.
- Add or update tests, documentation, compatibility notes, and screenshots or logs where relevant.
- Never include secrets, user data, internal documents, or unlicensed assets.
- Breaking changes require an explicit migration plan.

## Secondary development / 二次开发

If you customize Linco Bridge and want to submit code back to this repository, follow the secondary development rules:

- English: [Secondary Development Rules](docs/secondary-development.md)
- 简体中文：[二次开发规则](docs/zh-CN/secondary-development.md)

Key expectations:

- Third-party product integrations should add a custom channel adapter instead of repurposing the official `linco` channel.
- Changes to commands, protocol payloads, channel routing, official endpoints, package publishing, or self-update behavior need maintainer discussion before implementation.
- Server-side changes must treat connector frames as untrusted input and include validation, compatibility notes, and tests.

## Rights and authorization / 权利与授权

By submitting a contribution, you confirm that you have the right to submit the code, documentation, or other materials under the repository license.

If the project later adopts an additional DCO, CLA, or contributor sign-off requirement, it will be announced in the repository workflow before enforcement.

提交贡献即表示你确认自己有权按本仓库许可证提交相关代码、文档或其他材料。

如果项目后续引入额外的 DCO、CLA 或签署要求，会先在仓库流程中公开说明，再正式执行。
