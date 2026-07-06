import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { WsAdapter } from '@nestjs/platform-ws'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  app.enableCors({ origin: true })
  app.useWebSocketAdapter(new WsAdapter(app))

  const port = Number(process.env.PORT ?? 3300)
  await app.listen(port)

  const logger = new Logger('Bootstrap')
  logger.log(`HTTP  http://127.0.0.1:${port}/api/demo-config`)
  logger.log(`WS    ws://127.0.0.1:${port}/bridge/ws?token=appId:appSecret`)
}

void bootstrap()
