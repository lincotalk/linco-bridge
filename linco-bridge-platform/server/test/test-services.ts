import { BridgePresenceService } from '../src/bridge/bridge-presence.service'
import { BridgeRelayService } from '../src/bridge/bridge-relay.service'
import { BridgeService } from '../src/bridge/bridge.service'
import { ChatService } from '../src/chat/chat.service'
import { DatabaseService } from '../src/database/database.service'
import { ResourceAccessService } from '../src/shared/resource-access.service'
import { TEST_SEED_OWNER_ID } from '../src/shared/visitor-id.util'
import { VisitorContextService } from '../src/shared/visitor-context.service'

export function createTestServices() {
  VisitorContextService.setTestDefault(TEST_SEED_OWNER_ID)
  const database = DatabaseService.createInMemory()
  const visitorContext = new VisitorContextService()
  const resourceAccess = new ResourceAccessService(visitorContext, database)
  const presence = new BridgePresenceService()
  const relay = new BridgeRelayService()
  const bridgeService = new BridgeService(database, presence, relay, resourceAccess)
  const chatService = new ChatService(database, presence, bridgeService, relay, resourceAccess)
  return { database, visitorContext, resourceAccess, presence, relay, bridgeService, chatService }
}

export function resetTestVisitorContext(): void {
  VisitorContextService.setTestDefault(null)
}
