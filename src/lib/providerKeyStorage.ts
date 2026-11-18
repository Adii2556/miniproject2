import type { ProviderId } from './aiProviders'

export type SavedProviderKeys = Partial<Record<ProviderId, string>>
export type ProviderKeyPersistence = 'unsaved' | 'saved' | 'changed'

const STORAGE_KEY = 'doclense.saved-provider-keys.v1'
const PROVIDER_IDS: ProviderId[] = ['groq', 'nvidia', 'deepseek', 'openai']

function validKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const key = value.trim()
  if (!key || key.length > 512) return false
  return ![...key].some(character => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
}

export function loadSavedProviderKeys(): SavedProviderKeys {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Record<string, unknown>
    return Object.fromEntries(PROVIDER_IDS.flatMap(provider => validKey(parsed[provider])
      ? [[provider, parsed[provider].trim()]]
      : [])) as SavedProviderKeys
  } catch {
    return {}
  }
}

export function saveProviderKey(provider: ProviderId, value: string): SavedProviderKeys {
  if (!validKey(value)) throw new Error('Enter a valid API key before saving it.')
  const next = { ...loadSavedProviderKeys(), [provider]: value.trim() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function removeSavedProviderKey(provider: ProviderId): SavedProviderKeys {
  const next = loadSavedProviderKeys()
  delete next[provider]
  if (Object.keys(next).length === 0) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export const SAVED_PROVIDER_KEYS_STORAGE_KEY = STORAGE_KEY
