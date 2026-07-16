# Contributing

Thank you for helping improve Linco Bridge.

## Before Opening an Issue

Before opening an issue, please:

1. Search existing issues first.
2. Reproduce the issue on a supported or latest available version.
3. Include OS, installation method, agent name and version, reproduction steps, expected behavior, actual behavior, and redacted logs.
4. Report security issues privately according to `SECURITY.md`.

## Where to Open What

| Type | Where to open it |
| --- | --- |
| Reproducible bug | GitHub Issue |
| Product or protocol proposal | GitHub Issue |
| Documentation fix | Pull Request directly, or open an Issue first if the scope is unclear |
| Security issue | Follow `SECURITY.md` |
| Internal-only or confidential material | Do not submit it to the public repository |

## Pull Request Expectations

- Discuss protocol changes, cross-module work, breaking changes, and large features before implementation.
- Keep each PR focused on one theme, such as documentation, connector behavior, platform behavior, or protocol changes.
- Explain the user-visible impact, not only the implementation detail.
- Add or update tests, documentation, compatibility notes, screenshots, terminal logs, API examples, or short videos when relevant.
- Keep English and Chinese documentation aligned when they describe the same feature area.
- Never include secrets, user data, internal documents, private links, or unlicensed assets.
- Breaking changes require an explicit migration plan.
- Maintainers may request that unrelated changes be split or may decline changes that weaken safety and compatibility boundaries.

## Documentation Contributions

- Prefer concise, task-oriented writing over internal discussion-style wording.
- Use generic repository paths such as `linco-bridge-platform/server` instead of personal local machine paths.
- Do not publish private links, internal demo addresses, internal app packages, or unreviewed credentials.
- When adding screenshots, prefer stable product states and avoid exposing personal data, device names, local paths, or internal workspace names.

## Secondary Development

If you customize Linco Bridge and want to submit changes upstream, follow [Secondary Development Rules](docs/secondary-development.md). Third-party integrations should add a custom channel adapter instead of repurposing the official `linco` channel.

## Rights and Authorization

By submitting a contribution, you confirm that you have the right to submit the code, documentation, or other materials under the repository license.

Related tests, documentation, examples, and compatibility notes are part of the contribution when the change affects them.

---

# 参与贡献

感谢你帮助改进 Linco Bridge。

## 提交 Issue 前

提交 Issue 前，请先确认：

1. 已搜索已有 Issue。
2. 已在受支持版本或最新可用版本上复现问题。
3. 已准备系统、安装方式、Agent 名称与版本、复现步骤、预期结果、实际结果和脱敏日志。
4. 安全问题请按 `SECURITY.md` 的说明进行私密报告。

## 该去哪里提什么

| 类型 | 提交位置 |
| --- | --- |
| 可稳定复现的缺陷 | GitHub Issue |
| 产品或协议方案讨论 | GitHub Issue |
| 文档修复 | 可直接提交 Pull Request；范围不清晰时先提交 Issue |
| 安全问题 | 按 `SECURITY.md` 处理 |
| 内部或保密材料 | 不要提交到公开仓库 |

## Pull Request 期望

- 协议变更、跨模块改动、破坏性变更和大型功能请先讨论再实现。
- 每个 PR 尽量聚焦一个主题，例如文档、连接器行为、平台行为或协议调整。
- 请说明用户可感知的变化，而不只是实现细节。
- 请根据改动范围补充测试、文档、兼容性说明、截图、终端日志、API 示例或短视频。
- 同一功能区域的英文和中文文档应保持同步。
- 不要提交密钥、用户数据、内部文档、私有链接或未授权素材。
- 破坏性变更需要提供明确的迁移方案。
- 维护者可能要求拆分无关改动，也可能拒绝削弱安全或兼容性边界的改动。

## 文档贡献说明

- 文档应尽量简洁、面向任务，避免使用内部讨论式表达。
- 请使用通用仓库路径，例如 `linco-bridge-platform/server`，不要使用个人电脑路径。
- 不要发布私有链接、内部 Demo 地址、内部安装包或未审核凭证。
- 添加截图时，请优先使用稳定产品状态，避免暴露个人数据、设备名、本地路径或内部工作区名称。

## 二次开发

如果你基于 Linco Bridge 做定制开发，并希望把改动贡献回上游，请遵循 [二次开发规则](docs/zh-CN/secondary-development.md)。第三方集成应新增自定义 channel adapter，不要复用官方 `linco` 通道。

## 权利与授权

提交贡献即表示你确认自己有权按本仓库许可证提交相关代码、文档或其他材料。

如果改动影响测试、文档、示例或兼容性说明，这些内容也属于本次贡献的一部分。
