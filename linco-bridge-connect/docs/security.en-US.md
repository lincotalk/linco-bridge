# Security Notes

Linco Connect runs on the user's machine and bridges remote IM with local Agents. The core security principle is: credentials stay local, file reads are constrained, and dangerous operations require an explicit policy.

## Local Credentials

Configuration is stored in `.linco/config.json` under the user's home directory by default. Do not publish this file. Do not commit real `appId`, `appSecret`, `LINCO_TOKEN`, or local test-page URLs containing tokens.

Local test-page URLs include access tokens and are only for development and self-testing. Do not forward them to untrusted users. After the first successful tokenized visit, the connector stores a browser cookie scoped to the local test page so refreshes and same-origin reopens keep working. If browser site data is cleared, open the full URL printed by `linco-connect start` again.

## Remote WebSocket

Remote bridge connections should use `wss://` by default. Use `ws://` only for local debugging and only when `allowInsecureWs` is explicitly configured.

Logs must redact secret parameters. New logging code must not print `appSecret`, `token`, full authentication URLs, or attachment base64 content.

## Approval Modes

| Mode | Behavior |
| --- | --- |
| `manual` | Permission requests and dangerous operations require manual user confirmation. |
| `auto` | Permission requests and dangerous operations are confirmed automatically while keeping the default permission boundary. |
| `yolo` | Attempts to use the Agent's native permission or sandbox bypass mode. Use only in trusted environments. |

When users switch to `yolo`, Claude/Codex processes may restart so the native permission flags can be applied while resuming the same session.

## Attachments And File Reads

Inbound attachments are saved locally. Default limits include attachment count, per-file size, total size, and blocked high-risk executable/script extensions.

File delivery should only return regular non-hidden files under the current working directory, session runtime directory, or attachment directory, and only after size, type, and path validation. Do not relax this to arbitrary absolute paths.

Hidden files and files under hidden directories are rejected by default, including `.env`, `.git/config`, and `.ssh/*`. This can only be relaxed explicitly with `ALLOW_HIDDEN_GET_FILES=1` or `allowHiddenGetFiles: true`.

Agent replies should use Markdown file links whose targets are absolute paths. The remote IM fetches files on demand after the user clicks a reference.

## Internal Metadata

`_lincoMeta` and `type: "meta"` are bridge-layer routing fields. They should not be shown to users, written into Agent prompts, or concatenated into remote frontend user text.

## Self Update

`/update` installs a selected npm version and restarts the daemon service. Source checkouts do not allow self-update by default unless explicitly configured. New update logic should avoid shell string concatenation with unvalidated version values.

## Contributor Checklist

Add focused tests when changing:

| Area | Suggested tests |
| --- | --- |
| New message types | Protocol conversion and `turn_end` completion. |
| New slash commands | `slash_command_result` shape, error branches, and busy state. |
| File handling | Path traversal, dangerous extensions, hidden paths, and size limits. |
| Credential handling | Log redaction and URL redaction. |
| Permission behavior | `manual`, `auto`, and `yolo` modes. |
