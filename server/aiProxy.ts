export type ProviderId = 'groq' | 'nvidia' | 'deepseek' | 'openai'

interface ProviderTarget {
  label: string
  modelsUrl: string
  chatUrl: string
}

const PROVIDER_TARGETS: Record<ProviderId, ProviderTarget> = {
  groq: { label: 'Groq', modelsUrl: 'https://api.groq.com/openai/v1/models', chatUrl: 'https://api.groq.com/openai/v1/chat/completions' },
  nvidia: { label: 'NVIDIA NIM', modelsUrl: 'https://integrate.api.nvidia.com/v1/models', chatUrl: 'https://integrate.api.nvidia.com/v1/chat/completions' },
  deepseek: { label: 'DeepSeek', modelsUrl: 'https://api.deepseek.com/models', chatUrl: 'https://api.deepseek.com/chat/completions' },
  openai: { label: 'OpenAI', modelsUrl: 'https://api.openai.com/v1/models', chatUrl: 'https://api.openai.com/v1/chat/completions' },
}

export interface ProxyResult {
  status: number
  headers: Record<string, string>
  body: unknown
}

export interface ProxyBody {
  action?: unknown
  provider?: unknown
  payload?: unknown
  [key: string]: unknown
}

export interface GatewayRequestMetadata {
  apiKey?: string
  origin?: string
  host?: string
  contentType?: string
  fetchSite?: string
  requestMarker?: string
  clientId?: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatPayload {
  model: string
  messages: ChatMessage[]
  temperature: number
  max_tokens: number
  top_p: number
  response_format: { type: 'json_object' }
}

const MAX_REQUEST_BYTES = 2_000_000
const MAX_MESSAGE_CHARS = 500_000
const MAX_TOTAL_MESSAGE_CHARS = 1_500_000
const MAX_MESSAGES = 64
const MAX_UPSTREAM_RESPONSE_BYTES = 5_000_000
const UPSTREAM_TIMEOUT_MS = 45_000
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_REQUESTS = 120
const MAX_CLIENT_CONCURRENCY = 4
const MAX_GLOBAL_CONCURRENCY = 16
const MAX_RATE_BUCKETS = 2_000

const safeHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

function errorResult(status: number, category: string, message: string, retryAfter?: string | null): ProxyResult {
  const headers: Record<string, string> = { ...safeHeaders }
  if (retryAfter && /^[\w ,.:+-]{1,100}$/.test(retryAfter)) headers['Retry-After'] = retryAfter
  return { status, headers, body: { error: { category, message } } }
}

function classifyError(status: number, value: unknown): string {
  const text = JSON.stringify(value).toLocaleLowerCase().slice(0, 2_000)
  if (status === 401 || status === 403) return 'auth'
  if (status === 402 || /(?:insufficient|exhausted).{0,30}(?:credit|quota|balance)/.test(text)) return 'quota'
  if (status === 429) return /(?:quota|billing|credit|balance)/.test(text) ? 'quota' : 'rate_limit'
  if (status === 408 || status === 409 || status === 425 || status >= 500) return 'temporary'
  if (status === 413) return 'context'
  if (status === 404 || /model.{0,30}(?:not found|does not exist|unsupported)/.test(text)) return 'model'
  return 'request'
}

function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && Object.hasOwn(PROVIDER_TARGETS, value)
}

function containsControlCharacter(value: string): boolean {
  return [...value].some(character => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allow = new Set(allowed)
  return Object.keys(value).every(key => allow.has(key))
}

function validateApiKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const key = value.trim()
  return key && key.length <= 512 && !containsControlCharacter(key) ? key : null
}

function validateChatPayload(value: unknown): ChatPayload | null {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ['model', 'messages', 'temperature', 'max_tokens', 'top_p', 'response_format'])) return null
  const model = typeof value.model === 'string' ? value.model.trim() : ''
  if (!model || model.length > 200 || containsControlCharacter(model)) return null
  if (!Array.isArray(value.messages) || value.messages.length === 0 || value.messages.length > MAX_MESSAGES) return null

  const messages: ChatMessage[] = []
  let totalCharacters = 0
  let systemMessages = 0
  let hasUserMessage = false
  for (let index = 0; index < value.messages.length; index += 1) {
    const item = value.messages[index]
    if (!isPlainRecord(item) || !hasOnlyKeys(item, ['role', 'content'])) return null
    if (item.role !== 'system' && item.role !== 'user' && item.role !== 'assistant') return null
    if (typeof item.content !== 'string' || item.content.length === 0 || item.content.length > MAX_MESSAGE_CHARS) return null
    if (item.role === 'system') {
      systemMessages += 1
      if (index !== 0 || systemMessages > 1) return null
    }
    if (item.role === 'user') hasUserMessage = true
    totalCharacters += item.content.length
    if (totalCharacters > MAX_TOTAL_MESSAGE_CHARS) return null
    messages.push({ role: item.role, content: item.content })
  }
  if (!hasUserMessage) return null

  const temperature = value.temperature
  const maxTokens = value.max_tokens
  const topP = value.top_p
  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 1.2) return null
  if (typeof maxTokens !== 'number' || !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4_096) return null
  if (typeof topP !== 'number' || !Number.isFinite(topP) || topP <= 0 || topP > 1) return null
  if (!isPlainRecord(value.response_format) || !hasOnlyKeys(value.response_format, ['type']) || value.response_format.type !== 'json_object') return null

  return { model, messages, temperature, max_tokens: maxTokens, top_p: topP, response_format: { type: 'json_object' } }
}

class UpstreamResponseError extends Error {
  readonly reason: 'too-large' | 'invalid-json'

  constructor(reason: 'too-large' | 'invalid-json') {
    super(reason)
    this.reason = reason
  }
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_UPSTREAM_RESPONSE_BYTES) throw new UpstreamResponseError('too-large')
  if (!response.body) return null
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_UPSTREAM_RESPONSE_BYTES) {
        await reader.cancel()
        throw new UpstreamResponseError('too-large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(merged))
  } catch {
    throw new UpstreamResponseError('invalid-json')
  }
}

function safeUpstreamMessage(target: ProviderTarget, status: number, category: string): string {
  if (category === 'auth') return `${target.label} rejected the API key.`
  if (category === 'quota') return `${target.label} reports that the account quota or credits are exhausted.`
  if (category === 'rate_limit') return `${target.label} is rate limiting requests.`
  if (category === 'temporary') return `${target.label} is temporarily unavailable.`
  if (category === 'context') return `${target.label} rejected the request size.`
  if (category === 'model') return `${target.label} does not support the selected model for this request.`
  return `${target.label} rejected the request (${status}).`
}

/** Low-level allowlisted provider request. Public adapters must call handleAIRequest instead. */
export async function proxyAIRequest(input: ProxyBody, apiKeyValue: unknown): Promise<ProxyResult> {
  if (!isPlainRecord(input) || !hasOnlyKeys(input, ['action', 'provider', 'payload'])) {
    return errorResult(400, 'request', 'The provider request contains unsupported fields.')
  }
  if (!isProviderId(input.provider)) return errorResult(400, 'request', 'Choose a supported AI provider.')
  if (input.action !== 'models' && input.action !== 'chat') return errorResult(400, 'request', 'Unsupported provider action.')
  const apiKey = validateApiKey(apiKeyValue)
  if (!apiKey) return errorResult(400, 'auth', 'The API key format is invalid.')
  if (JSON.stringify(input).length > MAX_REQUEST_BYTES) return errorResult(413, 'context', 'The provider request is too large.')

  let chatPayload: ChatPayload | null = null
  if (input.action === 'models') {
    if (input.payload !== undefined && input.payload !== null) return errorResult(400, 'request', 'Model discovery does not accept a request payload.')
  } else {
    chatPayload = validateChatPayload(input.payload)
    if (!chatPayload) return errorResult(400, 'request', 'The chat request does not match the permitted schema or limits.')
  }

  const target = PROVIDER_TARGETS[input.provider]
  const isModels = input.action === 'models'
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const response = await fetch(isModels ? target.modelsUrl : target.chatUrl, {
      method: isModels ? 'GET' : 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(isModels ? {} : { 'Content-Type': 'application/json' }),
      },
      body: isModels ? undefined : JSON.stringify(chatPayload),
      redirect: 'error',
      signal: controller.signal,
    })
    let payload: unknown
    try {
      payload = await readBoundedJson(response)
    } catch (error) {
      if (error instanceof UpstreamResponseError && error.reason === 'too-large') return errorResult(502, 'temporary', `${target.label} returned an oversized response.`)
      return errorResult(502, 'temporary', `${target.label} returned an invalid response.`)
    }
    if (!response.ok) {
      const category = classifyError(response.status, payload)
      return errorResult(response.status, category, safeUpstreamMessage(target, response.status, category), response.headers.get('retry-after'))
    }
    return { status: response.status, headers: safeHeaders, body: payload }
  } catch (error) {
    if (controller.signal.aborted || (error as Error).name === 'AbortError') return errorResult(504, 'temporary', `${target.label} took too long to respond.`)
    return errorResult(503, 'temporary', `Could not reach ${target.label}.`)
  } finally {
    globalThis.clearTimeout(timer)
  }
}

interface RateBucket {
  startedAt: number
  requests: number
  active: number
  lastSeen: number
}

const rateBuckets = new Map<string, RateBucket>()
let globalActive = 0

function pruneRateBuckets(now: number): void {
  if (rateBuckets.size < MAX_RATE_BUCKETS) return
  for (const [key, bucket] of rateBuckets) {
    if (bucket.active === 0 && now - bucket.lastSeen > RATE_LIMIT_WINDOW_MS * 2) rateBuckets.delete(key)
  }
  while (rateBuckets.size >= MAX_RATE_BUCKETS) {
    const oldest = [...rateBuckets.entries()].filter(([, bucket]) => bucket.active === 0).sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0]
    if (!oldest) break
    rateBuckets.delete(oldest[0])
  }
}

function acquireGatewaySlot(clientIdValue: string | undefined): { release: () => void } | ProxyResult {
  const now = Date.now()
  pruneRateBuckets(now)
  const clientId = (clientIdValue ?? 'unknown').slice(0, 200)
  const existing = rateBuckets.get(clientId)
  const bucket = !existing || now - existing.startedAt >= RATE_LIMIT_WINDOW_MS
    ? { startedAt: now, requests: 0, active: existing?.active ?? 0, lastSeen: now }
    : existing
  bucket.lastSeen = now
  if (bucket.requests >= RATE_LIMIT_REQUESTS) {
    rateBuckets.set(clientId, bucket)
    return errorResult(429, 'rate_limit', 'Too many provider requests. Wait before trying again.', '60')
  }
  if (bucket.active >= MAX_CLIENT_CONCURRENCY || globalActive >= MAX_GLOBAL_CONCURRENCY) {
    rateBuckets.set(clientId, bucket)
    return errorResult(429, 'rate_limit', 'Too many provider requests are already in progress.', '2')
  }
  bucket.requests += 1
  bucket.active += 1
  globalActive += 1
  rateBuckets.set(clientId, bucket)
  let released = false
  return {
    release: () => {
      if (released) return
      released = true
      bucket.active = Math.max(0, bucket.active - 1)
      globalActive = Math.max(0, globalActive - 1)
    },
  }
}

function sameOriginRequest(metadata: GatewayRequestMetadata): boolean {
  if (metadata.requestMarker !== '1') return false
  if (!metadata.contentType?.toLocaleLowerCase().startsWith('application/json')) return false
  if (metadata.fetchSite && metadata.fetchSite !== 'same-origin') return false
  if (!metadata.origin || !metadata.host) return false
  try {
    const origin = new URL(metadata.origin)
    const loopback = origin.hostname === '127.0.0.1' || origin.hostname === 'localhost' || origin.hostname === '[::1]'
    if (origin.protocol !== 'https:' && !(loopback && origin.protocol === 'http:')) return false
    return origin.host.toLocaleLowerCase() === metadata.host.split(',')[0].trim().toLocaleLowerCase()
  } catch {
    return false
  }
}

/** Enforces the browser-to-gateway boundary before an allowlisted upstream request. */
export async function handleAIRequest(input: ProxyBody, metadata: GatewayRequestMetadata): Promise<ProxyResult> {
  if (!sameOriginRequest(metadata)) return errorResult(403, 'request', 'The provider gateway accepts same-origin JSON requests only.')
  const slot = acquireGatewaySlot(metadata.clientId)
  if ('status' in slot) return slot
  try {
    return await proxyAIRequest(input, metadata.apiKey)
  } finally {
    slot.release()
  }
}
