import { describe, expect, it } from 'vitest'

import {
  filterSlashCommands,
  slashCommandDisplayCommand,
  slashCommandsFromHelpPayload,
} from '@/bridge/slash-command'
import {
  clearSlashCommandCacheForTests,
  readSlashCommandsFromCache,
  slashCommandsMemoryKey,
  writeSlashCommandsToCache,
} from '@/utils/slash-command-cache'

describe('slashCommandsFromHelpPayload', () => {
  it('parses help items from payload', () => {
    const commands = slashCommandsFromHelpPayload({
      items: [
        {
          command: '/status',
          description: '查看状态',
        },
        {
          command: '/get',
          label: '/get <path>',
          description: '获取文件',
        },
      ],
    })

    expect(commands).toHaveLength(2)
    expect(commands[0]).toMatchObject({
      command: '/status',
      title: '/status',
      description: '查看状态',
    })
    expect(commands[1]).toMatchObject({
      command: '/get',
      label: '/get <path>',
      appendSpaceOnSelect: true,
    })
    expect(slashCommandDisplayCommand(commands[1])).toBe('/get <path>')
  })

  it('ignores invalid entries', () => {
    expect(slashCommandsFromHelpPayload(null)).toEqual([])
    expect(slashCommandsFromHelpPayload({ items: [{ command: 'status' }] })).toEqual([])
  })
})

describe('filterSlashCommands', () => {
  const commands = slashCommandsFromHelpPayload({
    items: [
      { command: '/help', description: '帮助' },
      { command: '/status', description: '状态' },
      { command: '/model --list', description: '模型列表' },
    ],
  })

  it('filters by prefix', () => {
    expect(filterSlashCommands(commands, '/st').map((item) => item.command)).toEqual(['/status'])
  })

  it('filters nested model options', () => {
    expect(filterSlashCommands(commands, '/model --l').map((item) => item.command)).toEqual([
      '/model --list',
    ])
  })
})

describe('slash command cache', () => {
  it('reads and writes scoped + shared cache', () => {
    clearSlashCommandCacheForTests()
    const items = slashCommandsFromHelpPayload({
      items: [{ command: '/help', description: '帮助' }],
    })

    writeSlashCommandsToCache('codex', 'conn-1', 'session-1', items)

    expect(readSlashCommandsFromCache('codex', 'conn-1', 'session-1')).toEqual(items)
    expect(readSlashCommandsFromCache('codex', 'conn-1')).toEqual(items)
    expect(slashCommandsMemoryKey('codex', 'conn-1', 'session-1')).toBe(
      'codex|conn-1|session-1',
    )
  })
})
