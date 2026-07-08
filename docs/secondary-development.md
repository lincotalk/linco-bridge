# Secondary Development Rules

[简体中文](zh-CN/secondary-development.md)

This page defines the rules for teams that customize Linco Bridge and want to submit changes back to this repository.

## Integration Boundary

- The official `linco` channel is reserved for the official Linco product flow.
- The open `linco-demo` channel is the reference implementation for local validation and secondary development.
- Product-specific H5, mini program, app, web, or IM integrations should add a custom channel adapter under `linco-bridge-connect/src/channel/<name>/` and register it through the channel registry.
- Do not repurpose the official `linco` channel for a third-party production product. Shared protocol helpers may be improved, but official-channel behavior must stay compatible with official Linco clients and services.

## Pull Request Rules

- Discuss protocol changes, command behavior changes, cross-module changes, and official-channel changes before implementation.
- Keep PRs scoped. Separate product-specific adapters from shared connector, protocol, server, or SDK changes.
- Include tests for changed command parsing, protocol mapping, relay behavior, or channel routing.
- Update docs and compatibility notes when payloads, event types, commands, or configuration behavior change.
- Do not commit App Secrets, tokens, real user data, production endpoint credentials, private logs, or unlicensed assets.
- Do not change npm package publishing metadata, self-update behavior, official WSS defaults, or release automation without maintainer approval.

## Command Changes

Commands in `linco-bridge-connect/src/command/` run on the user's computer. A fork can change local behavior for users who install that fork, but official PRs must preserve predictable behavior for official package users.

- Do not weaken safety checks for file access, attachment delivery, permission approval, danger confirmation, account removal, or process control.
- Keep existing command semantics backward compatible unless there is an accepted migration plan.
- Prefer adding narrowly scoped commands over changing the meaning of existing commands.
- User-visible command output changes should include tests when the output is parsed by the frontend or relay.

## Protocol Changes

Protocol mapping is part of the compatibility contract between connector, relay, SDKs, and clients.

- Treat connector frames as untrusted input on the server side.
- Add fields in a backward-compatible way whenever possible. Receivers should ignore unknown optional fields.
- Do not rename or remove existing event types or required fields without a protocol-version plan and release note.
- For breaking changes, introduce an explicit version, capability flag, new event type, or migration period.
- Server-side changes must validate `accountId`, `agentId`, `sessionKey`, `streamId`, payload size, file metadata, and event state against the authenticated connection.

## Custom Channel Guidance

Use a custom channel when the integration has product-specific message shapes, credentials, routing, UI events, or IM semantics.

Recommended shape:

- add `linco-bridge-connect/src/channel/<name>/`;
- keep protocol conversion inside that adapter;
- reuse shared helpers from `src/package/protocol` where appropriate;
- add focused tests under `linco-bridge-connect/test/channel/`;
- document setup commands and security boundaries for that channel.

## Review Standard

A secondary-development PR is easier to review when it answers:

- Which channel or product flow does this change affect?
- Does it affect official `linco`, `linco-demo`, or only a custom channel?
- Is the change backward compatible for existing `linco-connect` users?
- What server-side validation protects official services from malformed fork clients?
- What tests prove command, protocol, and relay behavior?
