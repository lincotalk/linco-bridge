# Linco Connect

[English](README.en-US.md) | [简体中文](README.zh-CN.md)

Linco Connect is a local Agent connector that runs on the user's machine. It forwards Linco IM messages to a local Agent CLI or Agent Gateway, then sends replies, streaming output, tool calls, permission confirmations, attachments, and generated file references back to IM.

It is not an authentication service or a hosted multi-tenant service. User credentials are stored in the local configuration file, and the default remote endpoint is built into the program. Most users do not need to manually configure a server address in the README or config file.

## Open-Source Positioning

Many Agent bridge projects integrate with existing collaboration platforms such as Feishu, WeChat, DingTalk, or similar IM products. This lowers the integration cost, but the display and interaction model is constrained by the host platform. Tool progress, permission confirmations, generated files, long-running sessions, and multi-Agent state are often hard to present comfortably.

Linco Connect is open-sourced together with a reference platform project. That platform corresponds to the `linco-demo` channel in this plugin. It is not meant to force everyone onto the official Linco IM. Instead, it gives users a deployable reference implementation: you can try the workflow first, then build your own H5 page, mini program, app, or other frontend channel and implement a matching channel adapter so the protocol, UI structure, and interaction experience can evolve with your product.

## Features

- Supports Claude Code, Codex, Hermes, OpenClaw, and related Agent integrations.
- Supports remote IM connections and a local test page for debugging.
- Supports text, image, and common document attachments.
- Supports generated file references. Agents return Markdown links with absolute local paths, and the IM can request the file on demand.
- Supports tool and command permission confirmations, dangerous-operation confirmations, and manual/auto/yolo approval modes.
- Supports session history viewing, binding, deletion, and token usage display.
- Supports channel adapters. `linco` is the official Linco IM adapter, and `linco-demo` is the open-source H5 demo channel.

## Requirements

- Node.js 20+. Node.js 22 LTS is recommended. `better-sqlite3` is used to speed up local Codex session lookup and currently supports Node.js 20/22/23/24/25/26.
- Install and sign in to the Agent CLI you plan to use:
  - `claude`
  - `codex`
  - `hermes`
  - `openclaw`
- Windows users are encouraged to install Git for Windows.

You only need to install the Agents you actually enable.

If `better-sqlite3` reports a native module or `NODE_MODULE_VERSION` error after a Node.js major-version upgrade, run `npm install` or `npm rebuild better-sqlite3` in the connector installation directory.

Verified Agent versions:

| Agent | Verified version | Notes |
| --- | --- | --- |
| Claude Code | `2.1.198 (Claude Code)` | Uses stream-json input/output, stdio permission confirmation, and `--append-system-prompt`. Configuration uses `agents.claude.*`, and session IDs are stored as `agentSessionId`. |
| Codex CLI | `codex-cli 0.142.5` | Uses `codex app-server --listen stdio://` by default. The workspace sandbox is `workspace-write`; network access is allowed by default and can be disabled with `LINCO_CODEX_NETWORK_ACCESS=0`. |
| OpenClaw | `OpenClaw 2026.5.18 (50a2481)` | Supports Gateway agent sessions and `openclaw agents list --json` / `openclaw gateway call --json agents.list`. Use `/agent` in a Linco session to view or bind the default OpenClaw Agent for future sessions. |
| Hermes | `Hermes Agent v0.13.0 (2026.5.7)` | Supports Hermes Gateway `/v1/runs` and `hermes profile list`. Use `/profile` in a Linco session to view or bind the default Hermes Profile for future sessions. |

Linco Connect injects a unified bridge identity prompt into Agents: the Agent is connected to Linco IM through Linco Connect, and normal text replies are automatically sent back to the user. Claude and Hermes use system-level or `instructions` injection. Codex and OpenClaw keep their existing protocol field shape and append the bridge prompt in the input layer.

## Installation

Run from source:

```bash
npm install
npm start
```

Install as a CLI:

```bash
npm install -g linco-connect
```

Run the local source CLI directly:

```bash
node bin/linco-connect.js --help
```

## Initialization

Token initialization is recommended:

```bash
linco-connect init --token "<appId>:<appSecret>" --agent claude
```

You can also pass credentials separately:

```bash
linco-connect init --app-id "<appId>" --app-secret "<appSecret>" --agent codex
```

Common options:

| Option | Description |
| --- | --- |
| `--agent <type>` | Enables an Agent, such as `claude`, `codex`, `hermes`, or `openclaw`. |
| `--account <name>` | Sets the account name. The default is `default`. |
| `--force` | Overwrites an existing configuration. |

Run `init` multiple times with different `--agent` values to enable multiple Agents.

Remove an account:

```bash
linco-connect remove-account --agent claude --account default
```

`delete-account` is an alias of `remove-account`. If the removed account is the default account of the current Agent, the connector switches to a remaining account automatically. If no account remains for that Agent, its channel configuration is removed.

The same can be done from a running remote IM session:

```text
/remove-account
/remove-account --agent claude --account default
```

## Start And Stop

Start in the foreground:

```bash
linco-connect start
```

Start as a daemon:

```bash
linco-connect start --daemon
```

Stop the daemon:

```bash
linco-connect stop
```

Reload the running service configuration:

```bash
linco-connect reload
```

Check the local environment:

```bash
linco-connect doctor
```

Remote upgrade and downgrade commands from IM:

```text
/update check
/update list
/update latest
/update 1.2.8
/update status
```

`/update latest` or `/update <version>` installs the selected npm version. After installation, the connector restarts as a daemon whether it was originally started in the foreground or background.

The local test page does not connect to the mock IM by default. Enable it explicitly for local integration:

```bash
linco-connect start --local-im
```

The terminal prints a local test-page URL with an access token. Do not share that URL or token with untrusted users.

## Configuration

Configuration is stored in `.linco/config.json` under the user's home directory by default. The initialization command writes credentials and a local test token automatically, so manual editing is usually unnecessary.

The running connector watches `config.json` for changes. You can also trigger reload with `linco-connect reload`. Account changes, credential updates, Agent enablement, and remote IM connection parameters are reloaded automatically, and only affected remote IM connections are restarted. Service-level options such as `host`, `port`, `lincoHome`, `sessionsDir`, and the local test page require a process restart. If reload fails, the old configuration remains active.

`linco` and `linco-demo` are independent channel keys. The official Linco IM adapter is in `src/channel/linco/`, and the open-source H5 demo adapter is in `src/channel/lincoDemo/`. The demo currently uses a Linco-compatible protocol, but it can evolve independently. Third-party platforms should add their own channel directory and register an adapter instead of changing the official Linco channel.

Minimal configuration example:

```json
{
  "defaultChannel": "linco",
  "channels": {
    "linco": {
      "agents": {
        "claude": {
          "defaultAccount": "default",
          "accounts": {
            "default": {
              "appId": "<appId>",
              "appSecret": "<appSecret>",
              "enabled": true
            }
          }
        }
      }
    }
  }
}
```

Common environment variables:

| Variable | Description |
| --- | --- |
| `LINCO_TOKEN` | Shorthand form of `<appId>:<appSecret>`. |
| `LINCO_AGENT` | Current default Agent type. |
| `LINCO_ACCOUNT` | Current account name. |
| `LINCO_HOME` | Runtime data directory. |
| `LINCO_LOCAL_AGENT` | Default Agent for the local test page. |
| `LINCO_CLAUDE_ENABLED` | Enables Claude. |
| `LINCO_CODEX_ENABLED` | Enables Codex. |
| `LINCO_HERMES_ENABLED` | Enables Hermes. |
| `LINCO_OPENCLAW_ENABLED` | Enables OpenClaw. |
| `LINCO_<AGENT>_BIN` | Overrides the Agent CLI command or path. |
| `LINCO_<AGENT>_WS_URL` | Overrides the remote connection URL for private deployment. |
| `LINCO_CLAUDE_INSTRUCTIONS` | Overrides the default response-style instructions appended by the Claude adapter. |
| `LINCO_CLAUDE_ADD_RUNTIME_DIR` | Set to `0` to avoid passing the session runtime directory to Claude CLI via `--add-dir`. |
| `LINCO_CODEX_NETWORK_ACCESS` | Set to `0` to disable network access for the Codex app-server workspace sandbox. |

## Attachments And File Delivery

Linco Connect supports common image, text, spreadsheet, document, PDF, archive, and similar attachments. High-risk executable and script extensions are blocked by default.

Default limits:

| Item | Limit |
| --- | --- |
| Attachments per message | 50 |
| Single file size | 50 MB |
| Total attachment size per message | 250 MB |

When an Agent needs to send a generated file to the user, it should save the file in the current working directory or the session runtime directory and include a Markdown file reference in its reply. The link target must be an absolute path, such as `[report.md](D:\path\report.md)`. Do not return only a bare path or a relative path.

The Agent-visible prompt only describes this return format. It does not expose the internal file-fetch command or delivery implementation. After the user clicks the reference, the remote IM can request the file and the connector returns it after validation.

The connector checks whether the path is absolute or relative to the current working directory. It only allows files under the current working directory, session runtime directory, or attachment directory, and it enforces regular-file, size, hidden-path, and dangerous-extension rules. On success, the remote IM receives an `outbound_message` with `mediaName`, `mediaType`, `mediaBase64`, `size`, and `references`.

By default, hidden files and files under hidden directories cannot be read, including `.env`, `.git/config`, and `.ssh/*`. If compatibility is required, set `ALLOW_HIDDEN_GET_FILES=1` or `allowHiddenGetFiles: true` explicitly.

## Linco Message Metadata

Incoming `inbound_message` events are converted into local Agent input. The connector keeps internal metadata for routing replies, streaming events, permission confirmations, and sessions:

```json
{
  "type": "meta",
  "agentId": "<agentId>",
  "_lincoMeta": {
    "accountId": "default",
    "messageId": "m-...",
    "agentId": "<agentId>"
  }
}
```

This metadata is bridge-layer routing data. It is not user text, should not be shown to the Agent, and should not be echoed to the user. Agent adapters must filter `type: "meta"` blocks when building prompts.

## Slash Commands

More contributor and frontend integration docs:

- [Architecture](docs/architecture.en-US.md)
- [Protocol](docs/protocol.en-US.md)
- [Slash commands](docs/slash-commands.en-US.md)
- [Security](docs/security.en-US.md)

Common commands:

| Command | Description |
| --- | --- |
| `/help` | Shows available local commands for the current mode. |
| `/status` | Shows the current session status. |
| `/pwd` | Shows the current project directory. Claude/Codex only. |
| `/cd <path>` | Binds the specified directory as the current project and starts a new Agent session. Claude/Codex only. |
| `/project` | Lists known projects from local Claude/Codex records. |
| `/sessions [limit]` | Lists recent local Agent sessions for the current project. Claude/Codex only. |
| `/chats [limit]` | Lists Codex Desktop sidebar chats. Codex only. |
| `/bind <Session ID>` | Binds the current IM session to an existing local Agent session. Claude/Codex only. |
| `/bind --chat <Chat ID>` | Binds to an existing Codex Desktop Chat. Codex only. |
| `/history [limit]` | Shows recent conversation history for the bound Agent session. Claude/Codex only. |
| `/history --chat <Chat ID> [limit]` | Previews Codex Desktop Chat history without binding. Codex only. |
| `/history-reload [limit]` | Refreshes local Agent memory, then reloads recent history. |
| `/agent` | Shows OpenClaw Agents and allows binding the default Agent for future sessions. OpenClaw only. |
| `/profile` | Shows Hermes Profiles and allows binding the default Profile for future sessions. Hermes only. |
| `/stop` | Stops the current Agent process and keeps the resumable session ID. |
| `/reload` | Refreshes current Agent memory and tries to prestart the process. |
| `/pc` | Shows the command for opening the current Agent session on PC. |
| `/base` | Shows runtime and attachment directories. |
| `/get <path>` | Reads an allowed non-hidden file from an allowed directory and returns it to the frontend. |
| `/approve` | Shows the current approval mode. |
| `/approve manual` | Requires manual confirmation for permission requests and dangerous operations. |
| `/approve auto` | Automatically confirms permission requests and dangerous operations while keeping the default permission boundary. |
| `/approve yolo` | Enables the Agent's native permission or sandbox bypass mode. |
| `/model` | Shows or switches the current Agent model. |
| `/usage` | Shows token usage if the Agent provides it. |
| `/remove-account` | Removes the account configuration for the current IM session. |
| `/delete-account` | Alias of `/remove-account`. |

Frontend command lists should be filtered by `agentType`. Local list/history commands return structured `slash_command_result` events that the remote IM can render by `command` and `data`; command turns still end with `turn_end`.

## Security Notes

- Do not publish configuration files, access tokens, `appSecret`, or local test-page URLs containing tokens.
- The local test page is only for development and self-testing.
- `/approve auto` allows subsequent permission requests and dangerous-operation confirmations. Use `/approve manual` when human confirmation is required.
- `/approve yolo` attempts to use the Agent's native permission or sandbox bypass mode and should only be used in trusted environments.
- Attachments are saved locally. Avoid uploading sensitive files that should not be written to disk.
- File delivery rejects hidden files and hidden directories by default to avoid accidental delivery of `.env`, `.git/config`, `.ssh/*`, and similar sensitive files.

## Development Commands

```bash
npm install
npm start
node bin/linco-connect.js doctor
npm test
```
