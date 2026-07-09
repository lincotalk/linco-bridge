import { NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { VisitorContextService } from '../src/shared/visitor-context.service'
import { createTestServices, resetTestVisitorContext } from './test-services'

describe('visitor isolation', () => {
  afterEach(() => {
    resetTestVisitorContext()
  })

  it('keeps sessions and connections scoped per visitor', () => {
    const visitorA = randomUUID()
    const visitorB = randomUUID()

    VisitorContextService.setTestDefault(null)

    const ctxA = createTestServices()
    const ctxB = createTestServices()

    let setupA!: ReturnType<typeof ctxA.bridgeService.getSetup>
    ctxA.visitorContext.run(visitorA, () => {
      setupA = ctxA.bridgeService.getSetup('codex')
      ctxA.database.touchSession(
        ctxA.database.getSessionByConnectionId(setupA.connectionId)!.id,
        'visitor-a-message',
      )
    })

    let setupB!: ReturnType<typeof ctxB.bridgeService.getSetup>
    ctxB.visitorContext.run(visitorB, () => {
      setupB = ctxB.bridgeService.getSetup('codex')
    })

    ctxA.visitorContext.run(visitorA, () => {
      expect(ctxA.chatService.listSessions()).toHaveLength(1)
      expect(setupA.connectionId).not.toBe(setupB.connectionId)
    })

    ctxB.visitorContext.run(visitorB, () => {
      expect(ctxB.chatService.listSessions()).toHaveLength(0)
    })
  })

  it('rejects cross-visitor session access', async () => {
    const owner = randomUUID()
    const other = randomUUID()
    VisitorContextService.setTestDefault(null)
    const ctx = createTestServices()

    let sessionId = ''
    ctx.visitorContext.run(owner, () => {
      const setup = ctx.bridgeService.getSetup('codex')
      sessionId = ctx.database.getSessionByConnectionId(setup.connectionId)!.id
    })

    await ctx.visitorContext.run(other, async () => {
      await expect(ctx.chatService.listMessages(sessionId)).rejects.toThrow(NotFoundException)
    })
  })
})
