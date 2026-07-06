/**
 * Copies bot + tabbar icons from AIChat Flutter assets into src/static.
 * Run: node scripts/generate-icons.mjs
 */
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = join(__dirname, '..')
const staticRoot = join(webRoot, 'src', 'static')
const aichatAssets = join(webRoot, '..', '..', '..', 'aichat', 'assets', 'icons')

async function copyIcon(relFrom, relTo) {
  const from = join(aichatAssets, relFrom)
  const to = join(staticRoot, relTo)
  await mkdir(dirname(to), { recursive: true })
  await copyFile(from, to)
}

const botIcons = ['codex.png', 'claude.png', 'hermes.png', 'claw.png']
const bridgeIcons = ['bridge_codex.png', 'bridge_claude.png', 'bridge_hermes.png', 'bridge_claw.png']

for (const name of botIcons) {
  await copyIcon(join('bot', name), join('icons', 'bot', name))
}

for (const name of bridgeIcons) {
  await copyIcon(join('bot', name), join('icons', 'bot', name))
}

await copyIcon(join('navs', 'users.png'), join('tabbar', 'messages.png'))
await copyIcon(join('navs', 'users_s.png'), join('tabbar', 'messages-active.png'))
await copyIcon(join('navs', 'market.png'), join('tabbar', 'bridge.png'))
await copyIcon(join('navs', 'market_s.png'), join('tabbar', 'bridge-active.png'))

console.log('Copied icons from aichat assets into src/static')
