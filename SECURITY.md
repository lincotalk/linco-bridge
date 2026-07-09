# Security Policy / 安全政策

## Report a vulnerability / 报告漏洞

Do not open a public issue for vulnerabilities involving credentials, authentication bypass, remote execution, unauthorized file access, session crossover, or private data exposure.

如问题涉及凭证、鉴权绕过、远程执行、未授权文件访问、会话串线或私密数据暴露，请不要提交公开 Issue。

Use GitHub Private Vulnerability Reporting for this repository. If private reporting is unavailable in your environment, open a minimal public issue that only requests a secure contact path and does not include technical details, proof of concept, credentials, payloads, or affected private data.

请优先使用本仓库的 GitHub Private Vulnerability Reporting。如果当前环境无法使用私密报告能力，请提交一个最小化的公开 Issue，仅说明你需要一个安全反馈渠道，不要包含技术细节、PoC、凭证、攻击载荷或受影响的私密数据。

Include:

- affected version and component;
- reproduction steps or proof of concept;
- potential impact;
- suggested mitigation, if available;
- whether the issue has been disclosed elsewhere.

## Security report handling / 安全报告处理方式

- Reports are first evaluated for impact, exploitability, affected scope, and whether the issue is already public.
- Maintainers may ask for clarification, reproduction details, or redacted logs before confirming severity.
- Fixes may be prepared privately first when public disclosure would materially increase risk.
- Public documentation is updated after a fix or mitigation path is ready when appropriate.

## Scope / 范围

Security fixes are prioritized for the latest released version and the current supported release line announced in repository releases or release notes.

Community security support is best effort and does not provide a contractual SLA.

安全修复优先覆盖最新正式发布版本，以及仓库 Release 或发布说明中声明的当前支持版本线。

社区安全支持尽力而为，不构成合同 SLA。

## Typical in-scope examples / 常见在范围内的问题

- Credential leakage in logs or responses.
- Unauthorized file access or path traversal.
- Session crossover or cross-account data mix-up.
- Remote execution, sandbox escape, or permission bypass caused by repository code.

## Usually out of scope / 通常不在范围内的问题

- Vulnerabilities that exist only in a contributor's unpublished private fork.
- Risks caused solely by intentionally insecure local demo settings in a trusted development environment.
- General security advice with no repository-specific bug or misconfiguration.
