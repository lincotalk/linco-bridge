# DeepSeek Harness Not Running Error Design

## Goal

When `linco-connect` is connected but DeepSeek Harness is not running, keep the existing bridge online status and return a clear Harness-not-running error from operations that require Harness.

## Scope

- Change only the DeepSeek adapter in `linco-connect` and its focused tests.
- Do not change bridge presence, heartbeat, service status fields, or Flutter UI state handling.
- Cover message sending, project listing, history loading, model loading, and other DeepSeek operations that use the shared Harness RPC client.

## Behavior

The shared Harness request path will inspect connection failures from `fetch` and WebSocket startup.

- A refused connection to the configured Harness URL is reported as `DeepSeek Harness 未启动，请先启动 Harness`.
- Timeouts, authentication failures, HTTP failures, and protocol errors retain their specific messages.
- Successful requests are unchanged.
- The bridge remains online while `linco-connect` remains connected to the remote service.

## Implementation Boundary

Add a small DeepSeek-specific error normalizer and use it at the HTTP RPC and event WebSocket connection boundaries. The normalizer must inspect nested Node.js error causes because `fetch` commonly wraps `ECONNREFUSED` in `TypeError: fetch failed`.

No health polling, runtime state machine, persistent status field, or service-side probing will be introduced.

## Verification

- Unit test a refused local Harness connection and assert the clear not-running message.
- Preserve existing mock Harness success tests.
- Verify a non-connection HTTP/RPC error is not mislabeled as Harness not running.
- Run the focused DeepSeek adapter test suite, followed by the plugin test suite if practical.

## Compatibility

The bridge protocol and API response shapes remain unchanged. Codex, Claude Code, Hermes, OpenClaw, the service, and Flutter clients are outside this change.
