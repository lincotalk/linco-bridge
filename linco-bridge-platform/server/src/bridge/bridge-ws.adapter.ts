import { Logger } from '@nestjs/common'
import { WsAdapter } from '@nestjs/platform-ws'
import type { Server as HttpServer } from 'node:http'
import { createServer } from 'node:http'
import { URL } from 'node:url'
import type { Server as WsServer } from 'ws'

/** Must match @WebSocketGateway path in bridge.gateway.ts */
export const BRIDGE_WS_GATEWAY_PATH = '/bridge/ws'

type WsRegistryEntry = WsServer & { path?: string }

type WsAdapterInternals = {
  httpServersRegistry: Map<number, HttpServer>
  wsServersRegistry: Map<number, WsRegistryEntry[]>
}

/**
 * linco-connect `linco-demo` preset uses per-agent paths such as
 * `/bridge/ws/claude`, while official `linco` uses `/socket/ai/{agent}`.
 * Accept both the base path and `/bridge/ws/*` subpaths.
 */
export class BridgeWsAdapter extends WsAdapter {
  private readonly bridgeLogger = new Logger(BridgeWsAdapter.name)

  protected ensureHttpServerExists(
    port: number,
    httpServer: HttpServer = createServer(),
  ): HttpServer {
    const internals = this as unknown as WsAdapterInternals
    if (internals.httpServersRegistry.has(port)) {
      return internals.httpServersRegistry.get(port)!
    }

    internals.httpServersRegistry.set(port, httpServer)

    httpServer.on('upgrade', (request, socket, head) => {
      try {
        const host = request.headers.host ?? 'localhost'
        const pathname = new URL(request.url ?? '/', `ws://${host}/`).pathname
        const wsServersCollection = internals.wsServersRegistry.get(port)
        let delegated = false

        for (const wsServer of wsServersCollection ?? []) {
          const gatewayPath = wsServer.path ?? ''
          if (!matchesBridgePath(pathname, gatewayPath)) {
            continue
          }

          wsServer.handleUpgrade(request, socket, head, (client) => {
            wsServer.emit('connection', client, request)
          })
          delegated = true
          break
        }

        if (!delegated) {
          this.bridgeLogger.debug(`Rejected WS upgrade path=${pathname}`)
          socket.destroy()
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        socket.end(`HTTP/1.1 400\r\n${message}`)
      }
    })

    return httpServer
  }
}

function matchesBridgePath(pathname: string, gatewayPath: string): boolean {
  if (pathname === gatewayPath) return true
  if (gatewayPath !== BRIDGE_WS_GATEWAY_PATH) return false
  return pathname.startsWith(`${BRIDGE_WS_GATEWAY_PATH}/`)
}

export function matchesBridgeWsPath(pathname: string, gatewayPath: string): boolean {
  return matchesBridgePath(pathname, gatewayPath)
}
