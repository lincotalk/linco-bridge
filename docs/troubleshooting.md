# Troubleshooting

[简体中文](zh-CN/troubleshooting.md)

## Device does not appear

1. Confirm that `linco-connect` is running.
2. Check the App ID, App Secret, agent type, and device name.
3. Check network access to the configured WSS endpoint.
4. Remove secrets before sharing logs.

## Credential is occupied

Each credential binds to one bridge instance. Stop or delete the previous bridge, or create a new credential.

## Session list is empty

- Confirm that the selected local agent has existing sessions.
- Confirm that the adapter supports session discovery for the tested version.
- Check whether index refresh failed or returned partial data.

## Before opening an issue

Include Linco Connect version, OS, installation method, agent and version, reproduction steps, expected and actual behavior, and redacted logs.

