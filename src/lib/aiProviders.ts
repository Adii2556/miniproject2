export type ProviderId = 'groq' | 'nvidia' | 'deepseek' | 'openai'
export type ProviderMode = 'manual' | 'automatic'
export type ProviderStatus = 'idle' | 'validating' | 'ready' | 'error'
export type ModelCompatibility = 'verified' | 'unverified' | 'incompatible'

export interface ProviderDefinition {
  id: ProviderId
  label: string
  shortLabel: string
  keyPlaceholder: string
  keyUrl: string
  recommendedHint: string
}
export interface ModelMetadata {
  id: string
  label: string
  ownedBy?: string
  contextWindow?: number
  maxOutputTokens?: number
  structuredJson?: boolean
  compatibility: ModelCompatibility
  reason: string
  discoveredAt: number
}
export interface ProviderRuntime {
  provider: ProviderId
  apiKey: string
  model: string
  consent: boolean
  compatibility?: ModelCompatibility
}

export interface AIExecutionConfig {
  mode: ProviderMode
  activeProvider: ProviderId
  priority: ProviderId[]
  providers: Partial<Record<ProviderId, ProviderRuntime>>
}

export interface ProviderEvent {
  type: 'attempt' | 'retry' | 'fallback'
  provider: ProviderId
  model: string
  message: string
  delayMs?: number
}

export const PROVIDERS: ProviderDefinition[] = [
  { id: 'groq', label: 'Groq', shortLabel: 'Groq', keyPlaceholder: 'gsk_…', keyUrl: 'https://console.groq.com/keys', recommendedHint: 'Choose an active production chat model.' },
  { id: 'nvidia', label: 'NVIDIA NIM', shortLabel: 'NVIDIA', keyPlaceholder: 'nvapi-…', keyUrl: 'https://build.nvidia.com/settings/api-keys', recommendedHint: 'Prefer an instruct/chat LLM with JSON support.' },
  { id: 'deepseek', label: 'DeepSeek', shortLabel: 'DeepSeek', keyPlaceholder: 'sk-…', keyUrl: 'https://platform.deepseek.com/api_keys', recommendedHint: 'Prefer a current chat model for reliable JSON output.' },
  { id: 'openai', label: 'OpenAI', shortLabel: 'OpenAI', keyPlaceholder: 'sk-…', keyUrl: 'https://platform.openai.com/api-keys', recommendedHint: 'Prefer a text model that supports Chat Completions.' },
]

export const DEFAULT_PROVIDER_ORDER: ProviderId[] = ['groq', 'nvidia', 'deepseek', 'openai']

export function providerDefinition(id: ProviderId): ProviderDefinition {
  return PROVIDERS.find(provider => provider.id === id) ?? PROVIDERS[0]
}

const incompatiblePattern = /(?:audio|whisper|speech|tts|transcri|embedding|moderation|image|dall-e|realtime|search-preview|guard|safety|rerank|reward|vision-only)/i
const likelyChatPattern = /(?:chat|instruct|gpt|llama|qwen|mistral|mixtral|gemma|deepseek|nemotron|phi|command|sonnet|reasoning|oss)/i

function numberField(value: Record<string, unknown>, names: string[]): number | undefined {
  for (const name of names) {
    const candidate = value[name]
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) return candidate
  }
  return undefined
}

function booleanField(value: Record<string, unknown>, names: string[]): boolean | undefined {
  for (const name of names) if (typeof value[name] === 'boolean') return value[name] as boolean
  return undefined
}

export function normalizeModelCatalog(payload: unknown): ModelMetadata[] {
  const data = payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
    ? (payload as { data: unknown[] }).data
    : []
  const now = Date.now()
  return data.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const raw = item as Record<string, unknown>
    if (typeof raw.id !== 'string' || !raw.id.trim() || raw.id.length > 200) return []
    const id = raw.id.trim()
    const active = raw.active
    const incompatible = active === false || incompatiblePattern.test(id)
    const likelyTextByName = likelyChatPattern.test(id)
    const verifiedByMetadata = !incompatible && (
      raw.type === 'chat'
      || raw.endpoint === 'chat.completions'
      || (Array.isArray(raw.capabilities) && raw.capabilities.some(value => String(value).toLocaleLowerCase().includes('chat')))
    )
    const compatibility: ModelCompatibility = incompatible ? 'incompatible' : verifiedByMetadata ? 'verified' : 'unverified'
    return [{
      id,
      label: typeof raw.display_name === 'string' ? raw.display_name : id,
      ownedBy: typeof raw.owned_by === 'string' ? raw.owned_by : undefined,
      contextWindow: numberField(raw, ['context_window', 'context_length', 'max_context_tokens']),
      maxOutputTokens: numberField(raw, ['max_completion_tokens', 'max_output_tokens', 'output_limit']),
      structuredJson: booleanField(raw, ['structured_outputs', 'supports_json', 'json_output']),
      compatibility,
      reason: incompatible
        ? 'Catalog metadata or model type indicates this is not a text chat model.'
        : verifiedByMetadata
          ? 'Provider metadata confirms chat-completion support.'
          : likelyTextByName
            ? 'The model name suggests text/chat use, but the catalog does not confirm JSON support. Run Test before analysis.'
            : 'The provider catalog does not expose enough capability data. Run Test before analysis.',
      discoveredAt: now,
    } satisfies ModelMetadata]
  }).sort((a, b) => {
    const rank = { verified: 0, unverified: 1, incompatible: 2 }
    return rank[a.compatibility] - rank[b.compatibility] || a.label.localeCompare(b.label)
  })
}

export function withModelCompatibility(
  catalog: ModelMetadata[],
  modelId: string,
  compatibility: ModelCompatibility,
  reason: string,
): ModelMetadata[] {
  const id = modelId.trim()
  if (!id) return catalog
  const existing = catalog.find(model => model.id === id)
  const updated: ModelMetadata = {
    ...(existing ?? { id, label: id, discoveredAt: Date.now() }),
    compatibility,
    structuredJson: compatibility === 'verified' ? true : compatibility === 'incompatible' ? false : existing?.structuredJson,
    reason,
  }
  return existing ? catalog.map(model => model.id === id ? updated : model) : [...catalog, updated]
}

class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly category: 'auth' | 'quota' | 'rate_limit' | 'temporary' | 'output' | 'context' | 'model' | 'request' | 'network',
    readonly status: number,
    readonly retryAfterMs = 0,
  ) {
    super(message)
    this.name = 'ProviderRequestError'
  }
}

export function providerErrorCategory(error: unknown): ProviderRequestError['category'] | undefined {
  return error instanceof ProviderRequestError ? error.category : undefined
}

interface ProxyErrorBody { error?: { category?: string; message?: string } }

function retryAfterMs(value: string | null): number {
  if (!value) return 0
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.min(30_000, Math.max(0, seconds * 1_000))
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? Math.min(30_000, Math.max(0, timestamp - Date.now())) : 0
}

async function proxyRequest(body: Record<string, unknown>, apiKey: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DocLense-Request': '1',
        'X-DocLense-Provider-Key': validateKey(apiKey),
      },
      body: JSON.stringify(body),
      signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ProviderRequestError('The provider gateway could not be reached.', 'network', 0)
  }
  let payload: unknown
  try { payload = await response.json() } catch { payload = null }
  if (!response.ok) {
    const safe = payload as ProxyErrorBody | null
    const rawCategory = safe?.error?.category
    const inferredCategory: ProviderRequestError['category'] = response.status === 401 || response.status === 403
      ? 'auth'
      : response.status === 402
        ? 'quota'
        : response.status === 429
          ? 'rate_limit'
          : response.status === 413
            ? 'context'
            : response.status >= 500 ? 'temporary' : 'request'
    const category = ['auth', 'quota', 'rate_limit', 'temporary', 'output', 'context', 'model', 'request'].includes(rawCategory ?? '')
      ? rawCategory as ProviderRequestError['category']
      : inferredCategory
    throw new ProviderRequestError(safe?.error?.message ?? `Provider request failed (${response.status}).`, category, response.status, retryAfterMs(response.headers.get('retry-after')))
  }
  return payload
}

export async function discoverProviderModels(provider: ProviderId, apiKey: string, signal?: AbortSignal): Promise<ModelMetadata[]> {
  const payload = await proxyRequest({ action: 'models', provider }, apiKey, signal)
  return normalizeModelCatalog(payload)
}

export async function testProviderModel(runtime: ProviderRuntime, signal?: AbortSignal): Promise<void> {
  const response = await proxyRequest({
    action: 'chat', provider: runtime.provider,
    payload: {
      model: runtime.model,
      temperature: 0,
      max_tokens: 64,
      top_p: 1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return valid JSON only.' },
        { role: 'user', content: 'Return {"compatible":true}.' },
      ],
    },
  }, runtime.apiKey, signal) as { choices?: Array<{ message?: { content?: string } }> }
  const content = response.choices?.[0]?.message?.content?.trim() ?? ''
  try {
    const parsed = JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()) as { compatible?: unknown }
    if (parsed.compatible !== true) throw new Error('missing compatibility result')
  } catch {
    throw new ProviderRequestError(`${providerDefinition(runtime.provider).label} did not return the required JSON format.`, 'request', 422)
  }
}

function validateKey(value: string): string {
  const key = value.trim()
  const hasControlCharacter = [...key].some(character => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
  if (!key || key.length > 512 || hasControlCharacter) throw new ProviderRequestError('Enter a valid API key.', 'auth', 0)
  return key
}

type QueueJob<T> = { run: () => Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void; estimatedTokens: number; provider: ProviderId; signal?: AbortSignal }

class SharedRequestQueue {
  private active = 0
  private readonly pending: QueueJob<unknown>[] = []
  private readonly nextProviderStart = new Map<ProviderId, number>()
  private readonly maxPending = 24

  enqueue<T>(provider: ProviderId, estimatedTokens: number, run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
        return
      }
      if (this.pending.length >= this.maxPending) {
        reject(new ProviderRequestError('Too many provider requests are queued. Wait for the current work to finish.', 'rate_limit', 429, 2_000))
        return
      }
      this.pending.push({ run, resolve: resolve as (value: unknown) => void, reject, estimatedTokens, provider, signal })
      this.pump()
    })
  }

  private pump() {
    while (this.active < 2 && this.pending.length > 0) {
      const job = this.pending.shift()
      if (!job) return
      this.active += 1
      const delay = Math.max(0, (this.nextProviderStart.get(job.provider) ?? 0) - Date.now())
      const pacing = Math.min(900, Math.max(80, Math.ceil(job.estimatedTokens / 1_000) * 90))
      this.nextProviderStart.set(job.provider, Date.now() + delay + pacing)
      globalThis.setTimeout(() => {
        if (job.signal?.aborted) {
          job.reject(job.signal.reason ?? new DOMException('Aborted', 'AbortError'))
          this.active -= 1
          this.pump()
          return
        }
        job.run().then(job.resolve, job.reject).finally(() => { this.active -= 1; this.pump() })
      }, delay)
    }
  }
}

const requestQueue = new SharedRequestQueue()
const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const cleanup = () => signal?.removeEventListener('abort', abort)
  const timer = globalThis.setTimeout(() => { cleanup(); resolve() }, ms)
  const abort = () => { globalThis.clearTimeout(timer); cleanup(); reject(signal?.reason ?? new DOMException('Aborted', 'AbortError')) }
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
})

function executionOrder(config: AIExecutionConfig): ProviderRuntime[] {
  const ids = config.mode === 'manual'
    ? [config.activeProvider]
    : [config.activeProvider, ...config.priority.filter(id => id !== config.activeProvider)]
  return ids.flatMap(id => {
    const runtime = config.providers[id]
    return runtime?.apiKey.trim() && runtime.model.trim() && runtime.consent && runtime.compatibility !== 'incompatible' ? [runtime] : []
  })
}

export async function runProviderCompletion(
  config: AIExecutionConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { maxTokens: number; temperature: number; signal?: AbortSignal; onEvent?: (event: ProviderEvent) => void },
): Promise<{ content: string; provider: ProviderId; model: string }> {
  const providers = executionOrder(config)
  if (providers.length === 0) throw new ProviderRequestError('Configure a provider, model, API key, and usage consent first.', 'auth', 0)
  let finalError: unknown
  const estimatedTokens = Math.ceil(messages.reduce((sum, message) => sum + message.content.length, 0) / 4) + options.maxTokens

  for (let providerIndex = 0; providerIndex < providers.length; providerIndex += 1) {
    const runtime = providers[providerIndex]
    if (providerIndex > 0) options.onEvent?.({ type: 'fallback', provider: runtime.provider, model: runtime.model, message: `Falling back to ${providerDefinition(runtime.provider).label} · ${runtime.model}` })
    for (let attempt = 0; attempt < 3; attempt += 1) {
      options.onEvent?.({ type: 'attempt', provider: runtime.provider, model: runtime.model, message: `Using ${providerDefinition(runtime.provider).label} · ${runtime.model}` })
      try {
        const payload = await requestQueue.enqueue(runtime.provider, estimatedTokens, () => proxyRequest({
          action: 'chat', provider: runtime.provider,
          payload: {
            model: runtime.model,
            temperature: options.temperature,
            max_tokens: options.maxTokens,
            top_p: 0.95,
            response_format: { type: 'json_object' },
            messages,
          },
        }, runtime.apiKey, options.signal), options.signal) as { choices?: Array<{ message?: { content?: string } }> }
        const content = payload.choices?.[0]?.message?.content ?? ''
        if (!content.trim()) throw new ProviderRequestError(`${providerDefinition(runtime.provider).label} returned an empty response.`, 'temporary', 502)
        return { content, provider: runtime.provider, model: runtime.model }
      } catch (error) {
        if ((error as Error).name === 'AbortError') throw error
        finalError = error
        const providerError = error instanceof ProviderRequestError ? error : new ProviderRequestError('Provider request failed.', 'network', 0)
        const retryable = providerError.status !== 504 && (providerError.category === 'rate_limit' || providerError.category === 'temporary' || providerError.category === 'output' || providerError.category === 'network')
        if (!retryable || attempt === 2) break
        const delay = providerError.retryAfterMs || Math.min(8_000, 750 * (2 ** attempt) + Math.floor(Math.random() * 250))
        options.onEvent?.({ type: 'retry', provider: runtime.provider, model: runtime.model, delayMs: delay, message: `${providerDefinition(runtime.provider).label} will retry in ${Math.ceil(delay / 1_000)}s` })
        await wait(delay, options.signal)
      }
    }
  }
  throw finalError ?? new ProviderRequestError('No configured provider could complete the request.', 'request', 0)
}

export function providerErrorDetails(error: unknown): { code: 'AUTH' | 'QUOTA' | 'RATE_LIMIT' | 'NETWORK' | 'SERVER' | 'BAD_JSON' | 'TOO_BIG' | 'UNKNOWN'; message: string } {
  if (!(error instanceof ProviderRequestError)) return { code: 'UNKNOWN', message: 'The AI provider request failed.' }
  if (error.category === 'auth') return { code: 'AUTH', message: error.message }
  if (error.category === 'quota') return { code: 'QUOTA', message: error.message }
  if (error.category === 'rate_limit') return { code: 'RATE_LIMIT', message: error.message }
  if (error.category === 'network') return { code: 'NETWORK', message: error.message }
  if (error.category === 'temporary') return { code: 'SERVER', message: error.message }
  if (error.category === 'output') return { code: 'BAD_JSON', message: error.message }
  if (error.category === 'context') return { code: 'TOO_BIG', message: error.message }
  return { code: 'UNKNOWN', message: error.message }
}

