import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, '..')

function loadEnvFile(envFileName) {
  const envPath = resolve(webRoot, envFileName)
  if (!existsSync(envPath)) {
    console.warn(`[with-prod-env] ${envFileName} not found, skipping`)
    return
  }

  console.log(`[with-prod-env] loading ${envFileName}`)

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

const uniArgs = process.argv.slice(2)
const envFileName = uniArgs[0]?.endsWith('.env') ? uniArgs.shift() : 'prod.env'
loadEnvFile(envFileName)

if (uniArgs.length === 0) {
  uniArgs.push('build')
}

const result = spawnSync('npx', ['uni', ...uniArgs], {
  cwd: webRoot,
  env: process.env,
  stdio: 'inherit',
  shell: true,
})

process.exit(result.status ?? 1)
