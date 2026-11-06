import { beforeEach, describe, expect, it } from 'vitest'
import { clearHistory, loadHistory, saveHistoryEntry } from './history'

describe('in-memory history', () => {
  beforeEach(() => clearHistory())

  it('keeps entries only in module memory and can clear them', () => {
    saveHistoryEntry({
      fileName: 'private.txt',
      kind: 'TEXT',
      pageCount: null,
      words: 2,
      title: 'Private',
      oneLiner: 'Sensitive text',
      text: 'sensitive source',
    })
    expect(loadHistory()).toHaveLength(1)
    clearHistory()
    expect(loadHistory()).toEqual([])
  })

  it('returns copies so callers cannot mutate the history collection', () => {
    const first = loadHistory()
    first.push({} as never)
    expect(loadHistory()).toEqual([])
  })
})
