# Contributing / 参与贡献

Thank you for helping improve Linco Bridge. / 感谢你帮助改进 Linco Bridge。

## Before opening an issue / 提交 Issue 前

1. Search existing issues and discussions. / 搜索已有 Issue 和 Discussion。
2. Reproduce on a supported or latest available version. / 在已支持或最新版本复现。
3. Include OS, installation method, agent and version, steps, expected behavior, actual behavior, and redacted logs. / 提供系统、安装方式、Agent 版本、步骤、预期 / 实际结果与脱敏日志。
4. Report security issues privately according to `SECURITY.md`. / 安全问题按 `SECURITY.md` 私密报告。

## What to open where / 该去哪里提什么

- Reproducible bug: GitHub Issue / 可稳定复现的缺陷：GitHub Issue
- Product or protocol proposal: GitHub Discussion or Issue / 产品或协议方案讨论：GitHub Discussion 或 Issue
- Documentation fix: Pull Request directly, or Issue first if scope is unclear / 文档修复：可直接提 Pull Request；范围不清晰时先提 Issue
- Security issue: follow `SECURITY.md` / 安全问题：按 `SECURITY.md` 处理
- Internal-only or confidential material: do not submit to the public repository / 内部或保密材料：不要提交到公开仓库

## Pull request expectations / Pull Request 期望

- Keep each PR focused on one theme such as docs, connector behavior, platform behavior, or protocol changes.
- Explain the user-visible impact, not only the implementation detail.
- Update related documentation when changing onboarding, protocol, commands, settings, or support scope.
- If English and Chinese docs describe the same feature area, keep them aligned in the same PR when possible.
- Include screenshots, terminal logs, API examples, or short videos when the change affects product presentation or integration flow.

## Pull requests

- Discuss protocol changes, cross-module work, and large features before implementation.
- Keep each PR focused and explain user-visible behavior.
- Add or update tests, documentation, compatibility notes, and screenshots or logs where relevant.
- Never include secrets, user data, internal documents, or unlicensed assets.
- Breaking changes require an explicit migration plan.

## Documentation contributions / 文档贡献说明

- Prefer concise, task-oriented writing over internal discussion-style wording.
- Use generic repository paths such as `linco-bridge-platform/server` instead of personal local machine paths.
- Do not publish private links, internal demo addresses, internal app packages, or unreviewed credentials.
- When adding screenshots, prefer stable product states and avoid exposing personal data, device names, or internal workspace names.

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

## Review and merge notes / 审查与合并说明

- Maintainers may ask contributors to split unrelated changes before review.
- Maintainers may decline changes that weaken safety boundaries, blur official vs custom channel behavior, or create undocumented compatibility breaks.
- A PR is not considered complete until related docs, examples, and compatibility notes are updated when needed.
