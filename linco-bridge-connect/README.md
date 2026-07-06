# linco-bridge

Local connector package for Linco Bridge compatible platforms.

This package runs on the user's PC and connects local Agent CLIs such as Claude Code and Codex to a bridge gateway over WebSocket. The default protocol mode is `linco`, so current Linco IM frame names and envelope fields remain compatible.

Built-in agents:

- `codex`
- `claude`
- `hermes`
- `openclaw`

## Commands

```bash
linco-bridge init --ws-url ws://127.0.0.1:3000/bridge/ws --token appId:appSecret --agent codex --channel linco
linco-bridge start
linco-bridge doctor
linco-bridge status
linco-bridge version
```

The connector runs one active turn per session. Additional messages for the same session are queued and drained in order. A platform can cancel the active local process by sending a `stop_turn` frame with the same `sessionKey`.

The connector also supports permission and danger confirmation frames. In Linco-compatible mode, `permission_response` and `danger_confirm` are normalized internally and routed back to the active agent session.

Codex defaults to `app-server` mode for persistent threads. Set `"mode": "exec"` under the Codex agent options to use the simpler one-shot fallback.

Agent adapters emit `agent_session` when a native session is established or resumed. Codex image generation items are sent as Linco-compatible `outbound_message.files`.

Hermes and OpenClaw can use an existing gateway URL or auto-start a local gateway on their default loopback ports. Set `autoStartGateway: false` to require an external gateway. Runtime model commands support listing and numeric selection when the agent gateway exposes model metadata.

Built-in connector commands:

- `/help`
- `/status`
- `/session`
- `/pwd`, `/cd <path>`, `/project [--select <path>]`
- `/sessions`, `/history`, `/history-reload`, `/sync-history`, `/chats`, `/bind <agentSessionId>`
- `/agent [--list|--select <id>|--bind <id>]` for OpenClaw
- `/profile [--list|--select <name>|--bind <name>]` for Hermes
- `/stop`, `/reload`
- `/pc` for Claude/Codex resume commands
- `/base`
- `/get <file-path>`
- `/remove-account [--agent <agent>] [--account <account>] [--channel <channel>]`
- `/update [check|list|status|latest|<version>]`
- `/approve [status|manual|auto|yolo]`
- `/model [status|list|clear|<model>|switch <number>]`
- `/reasoning [status|clear|low|medium|high|xhigh|max]`
- `/settings [apply --model <model> --reasoning <effort>]`
- `/usage`
- `/compact` for agent context compaction where supported.

## Agent Options

Config is stored at `~/.linco-bridge/config.json`.

```json
{
  "channels": {
    "linco": {
      "agents": {
        "codex": {
          "enabled": true,
          "accounts": {
            "default": {
              "appId": "app",
              "appSecret": "secret"
            }
          },
          "options": {
            "mode": "app-server",
            "model": "gpt-5"
          }
        },
        "claude": {
          "enabled": true,
          "accounts": {
            "default": {
              "appId": "app",
              "appSecret": "secret"
            }
          },
          "options": {
            "model": "sonnet"
          }
        },
        "hermes": {
          "enabled": true,
          "accounts": {
            "default": {
              "appId": "app",
              "appSecret": "secret"
            }
          },
          "options": {
            "gatewayUrl": "http://127.0.0.1:8642",
            "autoStartGateway": true
          }
        },
        "openclaw": {
          "enabled": true,
          "accounts": {
            "default": {
              "appId": "app",
              "appSecret": "secret"
            }
          },
          "options": {
            "gatewayUrl": "ws://127.0.0.1:18789",
            "autoStartGateway": true
          }
        }
      }
    }
  }
}
```

## Environment

Runtime environment variables follow the existing Linco connector behavior:

- `LINCO_CHANNEL`, `LINCO_AGENT`, `LINCO_ACCOUNT` select which configured connector accounts start.
- `LINCO_TOKEN` or `LINCO_APP_ID` plus `LINCO_APP_SECRET` override credentials when `LINCO_ACCOUNT` is selected.
- `LINCO_<AGENT>_BIN`, `LINCO_<AGENT>_MODEL`, `LINCO_<AGENT>_GATEWAY_URL`, `LINCO_<AGENT>_API_KEY`, `LINCO_<AGENT>_INSTRUCTIONS` override agent runtime options.
- `LINCO_CLAUDE_ADD_RUNTIME_DIR=0` disables Claude `--add-dir`.
- `LINCO_CODEX_MODE=exec` switches Codex to one-shot exec mode.
- `LINCO_CODEX_NETWORK_ACCESS=0` disables Codex app-server workspace network access.
- `LINCO_HERMES_PROFILE`, `LINCO_HERMES_HOME`, `LINCO_HERMES_BIN`, `LINCO_HERMES_AUTO_START_GATEWAY`, `LINCO_HERMES_PROFILE_SCOPED_GATEWAY` configure Hermes runtime and gateway behavior.
- `LINCO_OPENCLAW_AGENT_ID`, `LINCO_OPENCLAW_BIN`, `LINCO_OPENCLAW_AUTO_START_GATEWAY`, `LINCO_OPENCLAW_TURN_TIMEOUT_MS` configure OpenClaw runtime and gateway behavior.

Claude and Codex child processes inherit `process.env`. On Windows, missing Anthropic/OpenAI/Codex credentials are also read from User/Machine environment variables before spawning, matching the existing connector behavior.

## Layout

```text
bin/
src/
  capabilities/
    claude.js
    codex.js
    hermes.js
    openclaw.js
    profiles.js
  support/
    agentEnv.js
    claudeTranscript.js
  agents/
    claude.js
    codex.js
    hermes.js
    openclaw.js
  core/
    agentRegistry.js
  diagnostics/
    agentDoctor.js
  connector/
  security/
    dangerDetector.js
  protocol/
  sessions/
  attachments/
  commands/
    account.js
    agentSelection.js
    files.js
    model.js
    project.js
    settings.js
  config/
  cli/
test/
```
