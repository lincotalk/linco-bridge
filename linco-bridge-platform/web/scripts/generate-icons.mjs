/**
 * Copies bot icons and builds tabbar icons (gray idle + green active).
 * Run: node scripts/generate-icons.mjs
 */
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const BRAND_GREEN = { r: 0, g: 117, b: 74 }
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

/** Tint dark/outline pixels to brand green; keep light/transparent pixels. */
async function tintTabIcon(sourcePath, outputPath, color = BRAND_GREEN) {
  const image = sharp(sourcePath)
  const { width, height } = await image.metadata()
  if (!width || !height) {
    throw new Error(`Invalid icon dimensions: ${sourcePath}`)
  }

  const raw = await image.ensureAlpha().raw().toBuffer()
  for (let i = 0; i < raw.length; i += 4) {
    const alpha = raw[i + 3]
    if (alpha < 20) continue

    const r = raw[i]
    const g = raw[i + 1]
    const b = raw[i + 2]
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    if (luminance > 210) continue

    raw[i] = color.r
    raw[i + 1] = color.g
    raw[i + 2] = color.b
  }

  await mkdir(dirname(outputPath), { recursive: true })
  await sharp(raw, { raw: { width, height, channels: 4 } }).png().toFile(outputPath)
}

async function buildTabBarIcons(name, navFile) {
  const idleSrc = join(aichatAssets, 'navs', navFile)
  const idleDst = join(staticRoot, 'tabbar', `${name}.png`)
  const activeDst = join(staticRoot, 'tabbar', `${name}-active.png`)

  await mkdir(dirname(idleDst), { recursive: true })
  await copyFile(idleSrc, idleDst)
  await tintTabIcon(idleSrc, activeDst)
}

const botIcons = ['codex.png', 'claude.png', 'hermes.png', 'claw.png']
const bridgeIcons = ['bridge_codex.png', 'bridge_claude.png', 'bridge_hermes.png', 'bridge_claw.png']

for (const name of botIcons) {
  await copyIcon(join('bot', name), join('icons', 'bot', name))
}

for (const name of bridgeIcons) {
  await copyIcon(join('bot', name), join('icons', 'bot', name))
}

await buildTabBarIcons('messages', 'users.png')
await buildTabBarIcons('bridge', 'home.png')

const chatIcons = [
  ['chat/home_input_add.png', 'chat/home_input_add.png'],
  ['chat/home_input_voice.png', 'chat/home_input_voice.png'],
  ['bridge_workspace/folder.png', 'chat/folder.png'],
]

for (const [from, to] of chatIcons) {
  await copyIcon(from, to)
}

console.log('Generated tabbar icons with green active state (#00754a)')
