# Codex Visible Project Sessions Design

## Goal

Make `/sessions` return the same project-level Codex conversations shown by the Codex desktop UI, without exposing internal Subagent threads as selectable sessions.

## Observed Behavior

Codex stores both user-visible conversations and internal Subagent threads in the `threads` table. They share the same `cwd`. The plugin currently filters only by `archived = 0` and `cwd`, so recent Subagent threads consume the result limit and hide older user-visible conversations.

The JSONL fallback has the same semantic gap: it reads the session ID, workspace, and first message, but ignores `session_meta.payload.source`.

Claude does not currently reproduce this issue. Its collector scans only top-level transcript files in the encoded project directory, while Subagent work is not exposed as separate top-level sessions in the observed layout.

## Filtering Contract

- Exclude Codex threads whose normalized source identifies them as Subagent threads.
- Keep user threads and legacy threads whose source classification is absent.
- Apply the filter before the SQLite result limit so recent hidden threads cannot displace visible conversations.
- Apply the same rule to the JSONL fallback by reading `session_meta.payload.source`.
- Keep explicit lookup and binding by a known session ID compatible; this change only narrows project session listings.
- Do not change Claude production behavior.

## Compatibility

The SQLite reader must tolerate older `threads` schemas that do not contain `thread_source` or `source`. When classification columns are unavailable, it keeps the previous behavior rather than abandoning the state database.

Codex source values may be represented as:

- `thread_source = "subagent"`;
- a structured `source` object containing `subagent`;
- a serialized JSON `source` string containing a top-level `subagent` key.

All other source values remain visible.

## Implementation Shape

- Add a small source-classification helper shared by the SQLite and JSONL paths.
- Detect available SQLite columns before building the query.
- Add the strongest available pre-limit predicate:
  - prefer `thread_source` when present;
  - otherwise use `source` when present;
  - otherwise preserve the legacy query.
- Extend `readCodexSessionMeta` to return the session source for JSONL filtering.

## Tests

- SQLite: newer Subagent rows do not consume a small limit ahead of an older user thread.
- SQLite: structured/serialized Subagent source variants are excluded.
- SQLite: an older schema without classification columns still returns sessions.
- JSONL: Subagent session metadata is excluded while a normal session remains.
- Claude: existing top-level project session collection remains unchanged.

## Non-Goals

- Deleting or archiving Codex Subagent threads.
- Hiding a Subagent session when the caller explicitly supplies its ID.
- Changing service or Flutter payload parsing.
- Reconstructing parent/child thread trees in the mobile UI.
