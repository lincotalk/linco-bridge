# Linco Bridge Web

UniApp frontend for the self-hosted Linco Bridge demo platform.

## Stack

- Vue 3 + `<script setup lang="ts">`
- Pinia
- UniApp (H5 + WeChat mini program)
- ESLint 9 flat config + Prettier
- Vitest

## Scripts

```bash
npm install
node scripts/generate-icons.mjs
npm run dev:h5
npm run check          # typecheck + lint + format + test
npm run test
npm run lint
```

## Structure

```text
src/
  bridge/          # SDK placeholder + commands (Flutter-compatible)
  components/      # Shared UI
  composables/     # useBridgeConnection
  pages/           # messages / bridge / chat
  stores/          # Pinia stores (mock in Phase 1)
  utils/
```

## Phase 1 scope

- TabBar: 消息 / 桥接
- Bridge cards: Codex, Claude Code, Hermes, OpenClaw
- Connection pages with unchanged `linco-connect` commands
- Message list + chat UI with mock data
- No IM, no login, no Redis
