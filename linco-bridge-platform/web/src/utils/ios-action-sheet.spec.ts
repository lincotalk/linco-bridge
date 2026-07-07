import { describe, expect, it } from 'vitest'

import { iosActionSheetState, resolveIosActionSheet, showIosActionSheet } from './ios-action-sheet'

describe('ios-action-sheet', () => {
  it('resolves selected index', async () => {
    const pending = showIosActionSheet(['alpha', 'beta'])
    expect(iosActionSheetState.visible).toBe(true)
    expect(iosActionSheetState.items).toEqual(['alpha', 'beta'])

    resolveIosActionSheet(1)
    await expect(pending).resolves.toBe(1)
    expect(iosActionSheetState.visible).toBe(false)
  })

  it('resolves null on cancel', async () => {
    const pending = showIosActionSheet(['only'])
    resolveIosActionSheet(null)
    await expect(pending).resolves.toBeNull()
  })

  it('returns null for empty list', async () => {
    await expect(showIosActionSheet([])).resolves.toBeNull()
  })
})
