# Troubleshooting

[简体中文](zh-CN/troubleshooting.md)

## Device Not Detected

1. Confirm `linco-connect` is running: `linco-connect status` or `linco-connect doctor`.
2. Check that App ID, App Secret, Agent type, channel, and account match the client page.
3. For the official `linco` channel, check network access to the official WSS endpoint.
4. For the open reference platform `linco-demo`, confirm `linco-bridge-platform/server` is running on `http://127.0.0.1:3300`.
5. When local `linco-demo` uses `ws://`, the init command must include `--allow-insecure-ws`.
6. Remove secrets, tokens, and local test-page URLs before sharing logs.

## Reference Platform H5 Detection Fails

- Confirm both the H5 frontend and server are running.
- Confirm the connector was initialized with `--channel linco-demo`, not the default `linco`.
- Confirm the selected Agent matches the credential, for example Codex uses `demo-codex-app:demo-codex-secret`.
- Confirm a firewall or proxy is not blocking `127.0.0.1:3300`.

## Credential Already In Use

Each credential set usually binds to one bridge instance. Stop or delete the previous bridge, or create a new credential.

## Session List Is Empty

- Confirm the selected local Agent has sessions.
- Confirm the adapter supports session discovery for the tested version.
- Check whether index refresh failed or returned partial data.
- Hermes and OpenClaw require profile / agent binding before continuing validation.

## Before Opening an Issue

Provide Linco Connect version, operating system, Node.js version, installation method, Agent and Agent version, channel name, reproduction steps, expected and actual results, and redacted logs.
