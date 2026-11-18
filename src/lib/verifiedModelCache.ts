import type { ModelMetadata, ProviderId } from './aiProviders'

const CACHE_PREFIX = 'doclense.verified-model-catalog.v2.'
export const VERIFIED_MODEL_CACHE_TTL_MS = 10 * 60 * 1_000

interface StoredVerifiedCatalog {
  savedAt: number
  keyFingerprint: string
  models: ModelMetadata[]
}

async function keyFingerprint(provider: ProviderId, apiKey: string): Promise<string> {
  const input = new TextEncoder().encode(`${provider}\u0000${apiKey.trim()}`)
  const digest = await crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(digest).slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function loadVerifiedModelCache(provider: ProviderId, apiKey: string): Promise<ModelMetadata[]> {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${provider}`)
    if (!raw) return []
    const cached = JSON.parse(raw) as Partial<StoredVerifiedCatalog>
    const fingerprint = await keyFingerprint(provider, apiKey)
    if (
      typeof cached.savedAt !== 'number'
      || Date.now() - cached.savedAt >= VERIFIED_MODEL_CACHE_TTL_MS
      || cached.keyFingerprint !== fingerprint
      || !Array.isArray(cached.models)
    ) return []
    return cached.models.filter(model => model?.compatibility === 'verified' && typeof model.id === 'string' && Boolean(model.verifiedAt))
  } catch {
    return []
  }
}

export async function saveVerifiedModelCache(provider: ProviderId, apiKey: string, models: ModelMetadata[]): Promise<void> {
  try {
    const value: StoredVerifiedCatalog = {
      savedAt: Date.now(),
      keyFingerprint: await keyFingerprint(provider, apiKey),
      models: models.filter(model => model.compatibility === 'verified' && Boolean(model.verifiedAt)),
    }
    sessionStorage.setItem(`${CACHE_PREFIX}${provider}`, JSON.stringify(value))
  } catch {
    // Model discovery still works when browser storage or Web Crypto is unavailable.
  }
}

export function clearVerifiedModelCache(provider: ProviderId): void {
  try { sessionStorage.removeItem(`${CACHE_PREFIX}${provider}`) } catch { /* ignore unavailable storage */ }
}
