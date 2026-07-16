import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module'
import { BRIDGE_WS_GATEWAY_PATH, BridgeWsAdapter } from './bridge/bridge-ws.adapter'
import { resolveCorsOrigin } from './shared/cors.util'

async function bootstrap(): Promise<void> {
  // 关闭默认 100kb bodyParser，改为 25mb（图片 base64 入站；H5 / 小程序共用）
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  })
  app.use(json({ limit: '25mb' }))
  app.use(urlencoded({ extended: true, limit: '25mb' }))
  app.setGlobalPrefix('api')
  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'X-Linco-Visitor-Id',
      'X-Linco-Visitor-Session',
    ],
  })
  app.useWebSocketAdapter(new BridgeWsAdapter(app))

  const port = Number(process.env.PORT ?? 3300)
  await app.listen(port)

  const logger = new Logger('Bootstrap')
  logger.log(`HTTP  http://127.0.0.1:${port}/api/demo-config`)
  logger.log(
    `WS    ws://127.0.0.1:${port}${BRIDGE_WS_GATEWAY_PATH}/claude?token=appId:appSecret`,
  )
}

void bootstrap()
