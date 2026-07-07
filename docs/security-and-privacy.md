# Security and Privacy

[简体中文](zh-CN/security-and-privacy.md)

The root docs keep only project-level security boundaries. For connector-side details such as attachment rules, `/get` file-delivery restrictions, permission modes, and local simulator cautions, refer to:

- [Connector Security](../linco-bridge-connect/docs/security.en-US.md)
- [Linco Connect README: Security Notes](../linco-bridge-connect/README.en-US.md#security-notes)
- [Platform README](../linco-bridge-platform/README.md)
- [SECURITY.md](../SECURITY.md)

## Project-Level Principles

- Do not commit App Secrets, tokens, private keys, user data, or local test-page URLs containing tokens.
- Data visibility differs between the official channel, self-hosted reference platform, and custom adapters. Review the exact flow before connecting real data.
- Local `linco-demo` uses `ws://127.0.0.1:3300` by default and is only suitable for development validation. Public deployments should configure TLS/WSS, authentication, storage, audit, and log redaction.
- TLS/WSS is not end-to-end encryption. Do not claim end-to-end encryption, zero knowledge, or fully local processing unless implemented and reviewed for the exact flow in use.
