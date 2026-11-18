import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  SAVED_PROVIDER_KEYS_STORAGE_KEY,
  loadSavedProviderKeys,
  removeSavedProviderKey,
  saveProviderKey,
} from '../src/lib/providerKeyStorage'

describe('optional provider key persistence', () => {
  let values: Map<string, string>

  beforeEach(() => {
    values = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  test('keeps keys absent until the user explicitly saves one', () => {
    expect(loadSavedProviderKeys()).toEqual({})
    expect(values.has(SAVED_PROVIDER_KEYS_STORAGE_KEY)).toBe(false)
  })

  test('restores, updates, and removes only the selected provider key', () => {
    saveProviderKey('groq', '  gsk-first  ')
    saveProviderKey('openai', 'sk-openai')
    expect(loadSavedProviderKeys()).toEqual({ groq: 'gsk-first', openai: 'sk-openai' })

    saveProviderKey('groq', 'gsk-updated')
    expect(loadSavedProviderKeys()).toEqual({ groq: 'gsk-updated', openai: 'sk-openai' })

    removeSavedProviderKey('groq')
    expect(loadSavedProviderKeys()).toEqual({ openai: 'sk-openai' })
    removeSavedProviderKey('openai')
    expect(values.has(SAVED_PROVIDER_KEYS_STORAGE_KEY)).toBe(false)
  })

  test('ignores malformed stored values and rejects invalid new keys', () => {
    values.set(SAVED_PROVIDER_KEYS_STORAGE_KEY, JSON.stringify({ groq: '', openai: 42, deepseek: 'sk-valid' }))
    expect(loadSavedProviderKeys()).toEqual({ deepseek: 'sk-valid' })
    expect(() => saveProviderKey('groq', 'bad\u0000key')).toThrow('Enter a valid API key before saving it.')
  })
})
