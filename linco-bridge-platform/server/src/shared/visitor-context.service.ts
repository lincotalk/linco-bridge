import { BadRequestException, Injectable } from '@nestjs/common'
import { AsyncLocalStorage } from 'node:async_hooks'
import { TEST_SEED_OWNER_ID } from './visitor-id.util'

@Injectable()
export class VisitorContextService {
  private static testDefault: string | null = null
  private readonly storage = new AsyncLocalStorage<string>()

  static setTestDefault(visitorId: string | null): void {
    VisitorContextService.testDefault = visitorId
  }

  run<T>(visitorId: string, fn: () => T): T {
    return this.storage.run(visitorId, fn)
  }

  getVisitorId(): string {
    const fromStore = this.storage.getStore()
    if (fromStore) return fromStore
    if (VisitorContextService.testDefault) return VisitorContextService.testDefault
    throw new BadRequestException('缺少访客标识')
  }

  /** Used by in-memory DB seed in unit tests only. */
  static get seedOwnerId(): string {
    return TEST_SEED_OWNER_ID
  }
}
