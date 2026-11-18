export type ProviderId = 'groq' | 'nvidia' | 'deepseek' | 'openai'
export type ProviderMode = 'manual' | 'automatic'
export type ProviderStatus = 'idle' | 'validating' | 'ready' | 'error'
export type ModelCompatibility = 'verified' | 'unverified' | 'incompatible'
export type ModelVerificationPhase = 'discovering' | 'verifying'

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
  verifiedAt?: number
}
export interface ModelVerificationProgress {
  phase: ModelVerificationPhase
  checked: number
  total: number
}
export interface VerifiedModelDiscovery {
  models: ModelMetadata[]
  discoveredCount: number
  candidateCount: number
  filteredCount: number
  unavailableCount: number
  incompatibleCount: number
  temporaryFailureCount: number
  pendingCount: number
}
export interface ProviderRuntime {
  provider: ProviderId
  apiKey: string
  model: string
  consent: boolean
  compatibility?: ModelCompatibility
  contextWindow?: number
  maxOutputTokens?: number
  structuredJson?: boolean
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

const incompatiblePattern = /(?:audio|whisper|speech|tts|transcri|embedding|moderation|image|dall-e|realtime|search-preview|guard|safety|rerank|reward|vision-only|jailbreak|gliner|translate)/i
const likelyChatPattern = /(?:chat|instruct|gpt|llama|qwen|mistral|mixtral|gemma|deepseek|nemotron|phi|command|sonnet|reasoning|oss|minimax|kimi|glm|solar|sarvam|step-|inkling|laguna|(?:^|[/:-])o[1-9](?:[-.]|$))/i
const MIN_REQUIRED_CONTEXT_TOKENS = 8_192
const VERIFICATION_OUTPUT_TOKENS = 512

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

export function normalizeModelCatalog(provider: ProviderId, payload: unknown): ModelMetadata[] {
  const data = payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
    ? (payload as { data: unknown[] }).data
    : []
  const now = Date.now()
  return data.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const raw = item as Record<string, unknown>
    if (typeof raw.id !== 'string' || !raw.id.trim() || raw.id.length > 200) return []
    const id = raw.id.trim()
    const contextWindow = numberField(raw, ['context_window', 'context_length', 'max_context_tokens'])
    const outputModalities = Array.isArray(raw.output_modalities) ? raw.output_modalities.map(String) : undefined
    const status = typeof raw.status === 'string' ? raw.status.toLocaleLowerCase() : ''
    const apiCapabilities = raw.api_capabilities && typeof raw.api_capabilities === 'object'
      ? Object.keys(raw.api_capabilities as Record<string, unknown>)
      : []
    const catalogSaysChat = (
      raw.type === 'chat'
      || raw.endpoint === 'chat.completions'
      || (Array.isArray(raw.capabilities) && raw.capabilities.some(value => String(value).toLocaleLowerCase().includes('chat')))
      || apiCapabilities.some(value => value.toLocaleLowerCase().includes('chat'))
    )
    const likelyTextByName = likelyChatPattern.test(id)
    const shutdownAnnounced = typeof raw.shutdown_date === 'string' && raw.shutdown_date.trim().length > 0
    const explicitlyIncompatible = raw.active === false
      || shutdownAnnounced
      || status === 'deprecated'
      || status === 'inactive'
      || incompatiblePattern.test(id)
      || (outputModalities !== undefined && !outputModalities.includes('text'))
      || (contextWindow !== undefined && contextWindow < MIN_REQUIRED_CONTEXT_TOKENS)
      || booleanField(raw, ['structured_outputs', 'supports_json', 'json_output']) === false
    const candidate = !explicitlyIncompatible && (catalogSaysChat || likelyTextByName || provider === 'deepseek' || provider === 'nvidia')
    const compatibility: ModelCompatibility = candidate ? 'unverified' : 'incompatible'
    return [{
      id,
      label: typeof raw.display_name === 'string' ? raw.display_name : typeof raw.name === 'string' ? raw.name : id,
      ownedBy: typeof raw.owned_by === 'string' ? raw.owned_by : undefined,
      contextWindow,
      maxOutputTokens: numberField(raw, ['max_completion_tokens', 'max_output_tokens', 'output_limit']),
      structuredJson: booleanField(raw, ['structured_outputs', 'supports_json', 'json_output']),
      compatibility,
      reason: candidate
        ? 'Discovered from the provider catalog; live compatibility verification is pending.'
        : shutdownAnnounced
          ? 'The provider has announced a shutdown date for this model.'
          : 'Catalog metadata does not satisfy DocLense text, context, and JSON requirements.',
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
  const validatedKey = validateKey(apiKey)
  const controller = new AbortController()
  const abortFromParent = () => controller.abort(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
  if (signal?.aborted) abortFromParent()
  else signal?.addEventListener('abort', abortFromParent, { once: true })
  const timeout = globalThis.setTimeout(
    () => controller.abort(new DOMException('Provider request timed out', 'TimeoutError')),
    PROVIDER_REQUEST_TIMEOUT_MS,
  )
  let response: Response
  try {
    response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DocLense-Request': '1',
        'X-DocLense-Provider-Key': validatedKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
  } catch (error) {
    globalThis.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromParent)
    if (signal?.aborted) throw signal.reason ?? error
    if (controller.signal.aborted) throw new ProviderRequestError('The provider gateway took too long to respond.', 'temporary', 504)
    if (error instanceof ProviderRequestError) throw error
    throw new ProviderRequestError('The provider gateway could not be reached.', 'network', 0)
  }
  let payload: unknown
  try { payload = await response.json() } catch { payload = null } finally {
    globalThis.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromParent)
  }
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
  return normalizeModelCatalog(provider, payload)
}

function parseCompatibilityResult(content: string): boolean {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const candidates = [cleaned]
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end > start) candidates.push(cleaned.slice(start, end + 1))
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        compatible?: unknown
        title?: unknown
        oneLiner?: unknown
        summary?: { text?: unknown; citations?: Array<{ sourceId?: unknown; excerpt?: unknown }> }
        keyPoints?: Array<{ text?: unknown; citations?: unknown[] }>
        keywords?: unknown[]
        sentiment?: { label?: unknown; score?: unknown; confidence?: unknown; summary?: unknown; tones?: unknown[] }
        quiz?: Array<{ question?: unknown; options?: unknown[]; answer?: unknown; explanation?: unknown; difficulty?: unknown; citations?: unknown[] }>
        answer?: { text?: unknown; citations?: unknown[] }
        digests?: Array<{ chunkId?: unknown; overview?: unknown; claims?: unknown[]; keywords?: unknown[] }>
      }
      const citation = parsed.summary?.citations?.[0]
      const question = parsed.quiz?.[0]
      const sentiment = parsed.sentiment
      if (
        parsed.compatible === true
        && typeof parsed.title === 'string'
        && typeof parsed.oneLiner === 'string'
        && typeof parsed.summary?.text === 'string'
        && typeof citation?.sourceId === 'string'
        && typeof citation?.excerpt === 'string'
        && Array.isArray(parsed.keyPoints)
        && parsed.keyPoints.length > 0
        && Array.isArray(parsed.keyPoints[0].citations)
        && Array.isArray(parsed.keywords)
        && parsed.keywords.length > 0
        && typeof sentiment?.label === 'string'
        && typeof sentiment.score === 'number'
        && typeof sentiment.confidence === 'number'
        && typeof sentiment.summary === 'string'
        && Array.isArray(sentiment.tones)
        && typeof question?.question === 'string'
        && Array.isArray(question.options)
        && question.options.length === 4
        && typeof question.answer === 'number'
        && typeof question.explanation === 'string'
        && typeof question.difficulty === 'string'
        && Array.isArray(question.citations)
        && typeof parsed.answer?.text === 'string'
        && Array.isArray(parsed.answer.citations)
        && Array.isArray(parsed.digests)
        && parsed.digests.length > 0
        && typeof parsed.digests[0].chunkId === 'string'
        && typeof parsed.digests[0].overview === 'string'
        && Array.isArray(parsed.digests[0].claims)
        && Array.isArray(parsed.digests[0].keywords)
      ) return true
    } catch { /* try the extracted object */ }
  }
  return false
}

export async function testProviderModel(runtime: ProviderRuntime, signal?: AbortSignal): Promise<void> {
  const rawResponse = await proxyRequest({
    action: 'chat', provider: runtime.provider,
    payload: providerChatPayload(runtime, [
        { role: 'system', content: 'Return exactly one valid JSON object without markdown.' },
        { role: 'user', content: 'Return {"compatible":true,"title":"Schema check","oneLiner":"All required fields are present.","summary":{"text":"Evidence is present.","citations":[{"sourceId":"s1","excerpt":"Evidence is present."}]},"keyPoints":[{"text":"Evidence is present.","citations":[{"sourceId":"s1","excerpt":"Evidence is present."}]}],"keywords":["evidence","schema"],"sentiment":{"label":"Neutral","score":0,"confidence":100,"summary":"The tone is neutral.","tones":["neutral"]},"quiz":[{"question":"What is present?","options":["Evidence","Noise","Nothing","Unknown"],"answer":0,"explanation":"The source says evidence is present.","difficulty":"easy","citations":[{"sourceId":"s1","excerpt":"Evidence is present."}]}],"answer":{"text":"Evidence is present.","citations":[{"sourceId":"s1","excerpt":"Evidence is present."}]},"digests":[{"chunkId":"c1","overview":"Evidence is present.","claims":[{"text":"Evidence is present.","citations":[{"sourceId":"s1","excerpt":"Evidence is present."}]}],"keywords":["evidence"]}]}.' },
      ], VERIFICATION_OUTPUT_TOKENS, 0),
  }, runtime.apiKey, signal)
  const response = rawResponse && typeof rawResponse === 'object'
    ? rawResponse as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> }
    : {}
  const content = response.choices?.[0]?.message?.content?.trim() ?? ''
  if (parseCompatibilityResult(content)) return
  const endedEarly = response.choices?.[0]?.finish_reason === 'length' || !content
  const message = endedEarly
    ? `${providerDefinition(runtime.provider).label} ended verification before returning the required JSON.`
    : `${providerDefinition(runtime.provider).label} did not return the required DocLense JSON shape.`
  throw new ProviderRequestError(message, 'output', 422)
}

export async function discoverAndVerifyProviderModels(
  provider: ProviderId,
  apiKey: string,
  options: { signal?: AbortSignal; onProgress?: (progress: ModelVerificationProgress) => void } = {},
): Promise<VerifiedModelDiscovery> {
  options.onProgress?.({ phase: 'discovering', checked: 0, total: 0 })
  const discovered = await discoverProviderModels(provider, apiKey, options.signal)
  const candidates = discovered.filter(model => model.compatibility === 'unverified')
  const verified: ModelMetadata[] = []
  let unavailableCount = 0
  let incompatibleCount = 0
  let temporaryFailureCount = 0
  let checked = 0

  options.onProgress?.({ phase: 'verifying', checked, total: candidates.length })
  for (const candidate of candidates) {
    try {
      await testProviderModel({ provider, apiKey, model: candidate.id, consent: true }, options.signal)
      verified.push({
        ...candidate,
        compatibility: 'verified',
        structuredJson: true,
        reason: 'Verified with a live DocLense-shaped JSON chat request.',
        verifiedAt: Date.now(),
      })
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error
      const category = providerErrorCategory(error)
      if (category === 'auth' || category === 'quota') throw error
      if (category === 'model') unavailableCount += 1
      else if (category === 'request' || category === 'context' || category === 'output') incompatibleCount += 1
      else {
        temporaryFailureCount += 1
        checked += 1
        options.onProgress?.({ phase: 'verifying', checked, total: candidates.length })
        break
      }
    }
    checked += 1
    options.onProgress?.({ phase: 'verifying', checked, total: candidates.length })
  }

  const pendingCount = Math.max(0, candidates.length - verified.length - unavailableCount - incompatibleCount)
  return {
    models: verified.sort((a, b) => {
      const previewRank = /(?:preview|experimental|beta|alpha)/i
      return Number(previewRank.test(a.id)) - Number(previewRank.test(b.id))
        || (b.contextWindow ?? 0) - (a.contextWindow ?? 0)
        || a.label.localeCompare(b.label)
    }),
    discoveredCount: discovered.length,
    candidateCount: candidates.length,
    filteredCount: discovered.length - candidates.length,
    unavailableCount,
    incompatibleCount,
    temporaryFailureCount,
    pendingCount,
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
export const PROVIDER_REQUEST_TIMEOUT_MS = 130_000
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
    return runtime?.apiKey.trim() && runtime.model.trim() && runtime.consent && runtime.compatibility === 'verified' ? [runtime] : []
  })
}

export const PROVIDER_GATEWAY_MAX_OUTPUT_TOKENS = 4_096

/** The smallest verified output limit keeps automatic-provider fallback requests portable. */
export function executionOutputLimit(config: AIExecutionConfig): number {
  const limits = executionOrder(config).map(runtime => runtime.maxOutputTokens ?? PROVIDER_GATEWAY_MAX_OUTPUT_TOKENS)
  return Math.max(256, Math.min(PROVIDER_GATEWAY_MAX_OUTPUT_TOKENS, ...limits))
}

/** Reasoning tokens share the completion budget for the providers that expose them. */
export function executionOutputTokenMultiplier(config: AIExecutionConfig): number {
  return executionOrder(config).some(runtime => (
    (runtime.provider === 'openai' && openAIReasoningModelPattern.test(runtime.model))
    || (runtime.provider === 'groq' && groqReasoningModelPattern.test(runtime.model))
    || (runtime.provider === 'nvidia' && nvidiaReasoningModelPattern.test(runtime.model))
    || (runtime.provider === 'deepseek' && /(?:reasoner|r1|thinking)/i.test(runtime.model))
  )) ? 1.5 : 1
}

type CompletionMessage = { role: 'system' | 'user' | 'assistant'; content: string }

const openAIReasoningModelPattern = /^(?:o[1-9](?:-|$)|gpt-[5-9](?:[.-]|$))/i
const groqReasoningModelPattern = /(?:gpt-oss|qwen3|deepseek-r1|qwq|thinking)/i
const nvidiaReasoningModelPattern = /(?:gpt-oss|reasoning|thinking|qwq)/i

function providerChatPayload(
  runtime: ProviderRuntime,
  messages: CompletionMessage[],
  maxTokens: number,
  temperature: number,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: runtime.model,
    messages,
    max_tokens: maxTokens,
  }

  if (runtime.provider === 'openai') {
    delete payload.max_tokens
    payload.max_completion_tokens = maxTokens
    payload.response_format = { type: 'json_object' }
    if (openAIReasoningModelPattern.test(runtime.model)) {
      payload.messages = messages.map((message, index) => index === 0 && message.role === 'system'
        ? { ...message, role: 'developer' }
        : message)
      payload.reasoning_effort = 'low'
    } else {
      payload.temperature = temperature
      payload.top_p = 0.95
    }
    return payload
  }

  if (runtime.provider === 'groq') {
    delete payload.max_tokens
    payload.max_completion_tokens = maxTokens
    payload.temperature = temperature
    payload.top_p = 0.95
    payload.response_format = { type: 'json_object' }
    if (groqReasoningModelPattern.test(runtime.model)) {
      payload.reasoning_format = 'hidden'
      payload.reasoning_effort = 'low'
    }
    return payload
  }

  payload.temperature = temperature
  payload.top_p = 0.95
  if (runtime.provider === 'deepseek') payload.response_format = { type: 'json_object' }
  if (runtime.provider === 'nvidia' && nvidiaReasoningModelPattern.test(runtime.model)) payload.reasoning_effort = 'low'
  return payload
}

export async function runProviderCompletion(
  config: AIExecutionConfig,
  messages: CompletionMessage[],
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
        const rawPayload = await requestQueue.enqueue(runtime.provider, estimatedTokens, () => proxyRequest({
          action: 'chat', provider: runtime.provider,
          payload: providerChatPayload(runtime, messages, options.maxTokens, options.temperature),
        }, runtime.apiKey, options.signal), options.signal)
        const payload = rawPayload && typeof rawPayload === 'object'
          ? rawPayload as { choices?: Array<{ finish_reason?: string; message?: { content?: string; refusal?: string } }> }
          : {}
        const choice = payload.choices?.[0]
        const content = choice?.message?.content ?? ''
        if (choice?.message?.refusal) throw new ProviderRequestError(`${providerDefinition(runtime.provider).label} declined this request.`, 'request', 422)
        const finishReason = choice?.finish_reason?.toLocaleLowerCase()
        if (finishReason === 'length' || finishReason === 'max_tokens') {
          throw new ProviderRequestError(`${providerDefinition(runtime.provider).label} used the output budget before completing the required JSON.`, 'output', 422)
        }
        if (!content.trim()) {
          const reason = `${providerDefinition(runtime.provider).label} returned no JSON content.`
          throw new ProviderRequestError(reason, 'output', 422)
        }
        return { content, provider: runtime.provider, model: runtime.model }
      } catch (error) {
        if ((error as Error).name === 'AbortError') throw error
        finalError = error
        const providerError = error instanceof ProviderRequestError ? error : new ProviderRequestError('Provider request failed.', 'network', 0)
        const retryable = providerError.status !== 504 && (providerError.category === 'rate_limit' || providerError.category === 'temporary' || providerError.category === 'network')
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

