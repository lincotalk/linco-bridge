import { Module } from '@nestjs/common'
import { BridgeController } from './bridge.controller'
import { BridgeGateway } from './bridge.gateway'
import { BridgePresenceService } from './bridge-presence.service'
import { BridgeRelayService } from './bridge-relay.service'
import { BridgeService } from './bridge.service'

@Module({
  controllers: [BridgeController],
  providers: [BridgeService, BridgePresenceService, BridgeRelayService, BridgeGateway],
  exports: [BridgeService, BridgePresenceService, BridgeRelayService],
})
export class BridgeModule {}
