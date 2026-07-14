# Security Policy

## Report a Vulnerability

Do not open a public issue for vulnerabilities involving credentials, authentication bypass, remote execution, unauthorized file access, session crossover, or private data exposure.

Use GitHub Private Vulnerability Reporting for this repository. If private reporting is unavailable in your environment, email `369805210@qq.com`, or open a minimal public issue that only requests a secure contact path and does not include technical details, proof of concept, credentials, payloads, or affected private data.

Include:

- affected version and component;
- reproduction steps or proof of concept;
- potential impact;
- suggested mitigation, if available;
- whether the issue has been disclosed elsewhere.

## Security Report Handling

- Reports are first evaluated for impact, exploitability, affected scope, and whether the issue is already public.
- Maintainers may ask for clarification, reproduction details, or redacted logs before confirming severity.
- Fixes may be prepared privately first when public disclosure would materially increase risk.
- Public documentation is updated after a fix or mitigation path is ready when appropriate.

## Scope

Security fixes are prioritized for the latest released version and the current supported release line announced in repository releases or release notes.

Community security support is best effort and does not provide a contractual SLA.

## Typical In-Scope Examples

- Credential leakage in logs or responses.
- Unauthorized file access or path traversal.
- Session crossover or cross-account data mix-up.
- Remote execution, sandbox escape, or permission bypass caused by repository code.

## Usually Out of Scope

- Vulnerabilities that exist only in a contributor's unpublished private fork.
- Risks caused solely by intentionally insecure local demo settings in a trusted development environment.
- General security advice with no repository-specific bug or misconfiguration.

---

# 安全政策

## 报告漏洞

如问题涉及凭证、鉴权绕过、远程执行、未授权文件访问、会话串线或私密数据暴露，请不要提交公开 Issue。

请优先使用本仓库的 GitHub Private Vulnerability Reporting。如果当前环境无法使用私密报告能力，请发送邮件至 `369805210@qq.com`，或提交一个最小化的公开 Issue，仅说明你需要一个安全反馈渠道，不要包含技术细节、PoC、凭证、攻击载荷或受影响的私密数据。

请包含：

- 受影响版本和组件；
- 复现步骤或 PoC；
- 潜在影响；
- 可用的缓解建议；
- 该问题是否已在其他地方公开。

## 安全报告处理方式

- 维护者会先评估影响、可利用性、影响范围，以及问题是否已经公开。
- 在确认严重程度前，维护者可能会要求补充说明、复现细节或脱敏日志。
- 如果公开披露会显著增加风险，修复可能会先私下准备。
- 在修复或缓解路径准备好后，会在合适时更新公开文档。

## 范围

安全修复优先覆盖最新正式发布版本，以及仓库 Release 或发布说明中声明的当前支持版本线。

社区安全支持尽力而为，不构成合同 SLA。

## 常见在范围内的问题

- 日志或响应中泄露凭证。
- 未授权文件访问或路径穿越。
- 会话串线或跨账号数据混淆。
- 由仓库代码导致的远程执行、沙箱逃逸或权限绕过。

## 通常不在范围内的问题

- 只存在于贡献者未公开私有 fork 中的漏洞。
- 仅由可信开发环境中的故意不安全本地 Demo 配置导致的风险。
- 没有仓库特定漏洞或错误配置的泛化安全建议。
