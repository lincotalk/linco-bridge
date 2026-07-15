# Security and Privacy

[简体中文](zh-CN/security-and-privacy.md)

This page summarizes the repository-level security and privacy boundary for Linco Bridge. It is intentionally lighter than the connector security spec, but it should still help readers understand what is safe to claim, what must stay local, and what must be reviewed before real deployment.

Detailed references:

- [Connector Security](../linco-bridge-connect/docs/security.en-US.md)
- [Linco Bridge connector README: Security Notes](../linco-bridge-connect/README.en-US.md#security-notes)
- [Platform README](../linco-bridge-platform/README.md)
- [SECURITY.md](../SECURITY.md)

## Core Security Model

Linco Bridge connects remote clients with Agents running on a user's own computer. That means the core boundary is not only network security, but also:

- local credential handling;
- file read and file delivery constraints;
- dangerous-operation approval flow;
- channel-specific data visibility;
- trust boundaries between connector, backend, and client UI.

## Project-Level Principles

- Do not commit App Secrets, tokens, private keys, user data, or local test-page URLs containing tokens.
- Data visibility differs between the official channel, self-hosted reference platform, hosted demo, and custom adapters. Review the exact flow before connecting real data.
- Local `linco-demo` uses `ws://127.0.0.1:3300` by default and is only suitable for development validation. Public deployments should configure TLS/WSS, authentication, storage, audit, and log redaction.
- TLS/WSS is not end-to-end encryption. Do not claim end-to-end encryption, zero knowledge, or fully local processing unless that exact flow has been implemented and reviewed.
- Official services and production backends must treat connector frames as untrusted input, including frames from modified or forked clients.

## Privacy Differences By Deployment Path

| Path | Typical privacy boundary | Notes |
| --- | --- | --- |
| Official channel (`linco`) | Follows the official product flow | Review official product policy and actual deployment behavior |
| Local reference platform (`linco-demo`) | Mostly local evaluation on the user's machine and local server | Useful for validation, not a production security model |
| Hosted demo | Public evaluation environment | Do not treat it as a private or durable workspace unless isolation is explicitly implemented; **third-party forked frontends must not call the official demo API—self-host the server instead** |
| Custom channel | Depends on your own backend and client design | You own authentication, storage, audit, and deletion policy |

## File And Attachment Boundaries

Generated files and inbound attachments are powerful, but they are also a security surface:

- file delivery should stay limited to validated non-hidden files under allowed directories;
- hidden files such as `.env`, `.git/config`, and `.ssh/*` should remain blocked by default;
- logs should not print full secrets, full auth URLs, or attachment base64 payloads;
- public demos should avoid exposing personal data, internal paths, or operator-only assets in screenshots and examples.

## Approval And Dangerous Operations

Repository docs should continue to make the approval model visible:

| Mode | Meaning |
| --- | --- |
| `manual` | Explicit confirmation for permission requests and dangerous operations |
| `auto` | Automatic confirmation while keeping the default permission boundary |
| `yolo` | Attempts to use the Agent's native bypass mode and should only be used in trusted environments |

If a deployment path, UI flow, or doc example changes approval behavior, that change should be documented clearly.

## Claims You Should Not Make Lightly

Avoid claiming any of the following unless they are implemented and verified for the exact flow in use:

- end-to-end encryption;
- zero-knowledge storage;
- fully local processing;
- persistent privacy isolation in a public demo;
- production-grade multi-tenant security guarantees.

## Contributor Review Checklist

When docs or code touch security-sensitive areas, review at least:

- credential storage and log redaction;
- file-delivery limits and hidden-path behavior;
- approval flow changes;
- public demo isolation or shared-state behavior;
- backend validation of connector-originated frames.

Security vulnerabilities should follow the private reporting path in [SECURITY.md](../SECURITY.md).
