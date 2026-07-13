import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const h5Dist = resolve(webRoot, 'dist/build/h5')
const assetsDir = resolve(h5Dist, 'assets')

function fail(message) {
  console.error(`[verify-h5-tabbar] ${message}`)
  process.exit(1)
}

if (!existsSync(h5Dist)) {
  fail('dist/build/h5 不存在，请先执行 npm run build:h5')
}

if (!existsSync(assetsDir)) {
  fail('dist/build/h5/assets 不存在，构建产物不完整')
}

const indexFiles = readdirSync(assetsDir).filter((name) => /^index-.*\.js$/.test(name))
if (indexFiles.length === 0) {
  fail('assets/ 下找不到 index-*.js')
}

const bundle = readFileSync(resolve(assetsDir, indexFiles[0]), 'utf8')

if (!bundle.includes('pages/agents/index')) {
  fail('bundle 缺少 pages/agents/index 路由')
}

const hasAgentsTab =
  /pagePath:"pages\/agents\/index",text:"助手"/.test(bundle) ||
  /pagePath:'pages\/agents\/index',text:'助手'/.test(bundle)

if (!hasAgentsTab) {
  fail(
    'tabBar.list 未包含「助手」Tab。若只更新了部分静态资源，线上会出现中间 Tab 空白（路由 3 项、tabBar 仅 2 项）',
  )
}

for (const icon of ['agents.png', 'agents-active.png']) {
  const iconPath = resolve(h5Dist, 'static/tabbar', icon)
  if (!existsSync(iconPath)) {
    fail(`缺少 static/tabbar/${icon}`)
  }
}

console.log('[verify-h5-tabbar] OK：底部 Tab 含「消息 / 助手 / 桥接」')
