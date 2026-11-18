import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ModelMetadata } from '../src/lib/aiProviders'
import {
  loadVerifiedModelCache,
  saveVerifiedModelCache,
  VERIFIED_MODEL_CACHE_TTL_MS,
} from '../src/lib/verifiedModelCache'

function storageMock() {
  const values = new Map<string, string>()
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size },
    } satisfies Storage,
  }
}

const verifiedModel: ModelMetadata = {
  id: 'vendor/chat-model',
  label: 'Chat Model',
  compatibility: 'verified',
  structuredJson: true,
  reason: 'Verified live.',
  discoveredAt: 1,
  verifiedAt: 2,
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('verified model cache', () => {
  test('is scoped to a key fingerprint without storing the API key', async () => {
    const mock = storageMock()
    vi.stubGlobal('sessionStorage', mock.storage)

    await saveVerifiedModelCache('openai', 'sk-secret-one', [verifiedModel])

    expect(await loadVerifiedModelCache('openai', 'sk-secret-one')).toEqual([verifiedModel])
    expect(await loadVerifiedModelCache('openai', 'sk-secret-two')).toEqual([])
    expect([...mock.values.values()].join('')).not.toContain('sk-secret-one')
  })

  test('expires verified results instead of claiming stale availability', async () => {
    const mock = storageMock()
    vi.stubGlobal('sessionStorage', mock.storage)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T00:00:00Z'))
    await saveVerifiedModelCache('groq', 'gsk-test', [verifiedModel])

    vi.setSystemTime(new Date(Date.now() + VERIFIED_MODEL_CACHE_TTL_MS + 1))

    expect(await loadVerifiedModelCache('groq', 'gsk-test')).toEqual([])
  })
})
