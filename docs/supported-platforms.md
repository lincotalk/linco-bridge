# Supported Platforms

[简体中文](zh-CN/supported-platforms.md)

This page documents release intent and compatibility-reporting rules for the first open-source release.

| Agent | Release scope | Compatibility reporting | Notes |
| --- | --- | --- | --- |
| Codex CLI | Included in the first open-source release | Exact tested versions and operating-system coverage should be published in release notes | Supports the reference bridge flow and reference platform integration |
| Claude Code | Included in the first open-source release | Exact tested versions and operating-system coverage should be published in release notes | Supports the reference bridge flow and reference platform integration |
| Hermes | Included in the first open-source release | Exact tested versions and operating-system coverage should be published in release notes | Includes profile-binding flow in compatible clients |
| OpenClaw | Included in the first open-source release | Exact tested versions and operating-system coverage should be published in release notes | Includes agent-binding flow in compatible clients |

## Publishing rule

- Keep README, release notes, and compatibility statements aligned.
- Publish exact tested versions in releases once validation is complete.
- If a specific agent or operating system is shipped with limitations, list them in release notes and troubleshooting docs rather than leaving the release scope ambiguous.
