import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  discoverProviderModels,
  normalizeModelCatalog,
  runProviderCompletion,
  type AIExecutionConfig,
} from '../src/lib/aiProviders'
import { handleAIRequest, proxyAIRequest } from '../server/aiProxy'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const validChatPayload = {
  model: 'safe-chat-model',
  temperature: 0.2,
  max_tokens: 256,
  top_p: 0.95,
  response_format: { type: 'json_object' },
  messages: [{ role: 'user', content: 'Return JSON.' }],
}

describe('provider discovery and compatibility', () => {
  test('keeps likely chat models, marks unknown models, and filters known non-text models', () => {
    const models = normalizeModelCatalog({ data: [
      { id: 'meta/llama-3.3-70b-instruct', context_window: 131_072, active: true },
      { id: 'vendor/new-model', active: true },
      { id: 'whisper-large-v3', active: true },
    ] })
    expect(models.find(model => model.id.includes('llama'))).toMatchObject({ compatibility: 'verified', contextWindow: 131_072 })
    expect(models.find(model => model.id === 'vendor/new-model')).toMatchObject({ compatibility: 'unverified' })
    expect(models.find(model => model.id.includes('whisper'))).toMatchObject({ compatibility: 'incompatible' })
  })

  test('discovers account-specific models through the same-origin gateway', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'deepseek-chat', context_window: 128_000 }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const models = await discoverProviderModels('deepseek', 'sk-test')
    expect(models[0]).toMatchObject({ id: 'deepseek-chat', compatibility: 'verified' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai')
    const request = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(request).toEqual({ action: 'models', provider: 'deepseek' })
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['X-DocLense-Provider-Key']).toBe('sk-test')
    expect(headers['X-DocLense-Request']).toBe('1')
    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe('omit')
  })
})
describe('provider fallback and proxy privacy', () => {
  test('falls back on exhausted quota without retrying or looping', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { category: 'quota', message: 'Groq quota exhausted.' } }), { status: 402 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const execution: AIExecutionConfig = {
      mode: 'automatic', activeProvider: 'groq', priority: ['groq', 'nvidia', 'deepseek', 'openai'],
      providers: {
        groq: { provider: 'groq', apiKey: 'gsk-test', model: 'llama-chat', consent: true },
        nvidia: { provider: 'nvidia', apiKey: 'nvapi-test', model: 'meta/llama-instruct', consent: true },
      },
    }
    const events: string[] = []
    const result = await runProviderCompletion(execution, [{ role: 'user', content: 'Return JSON.' }], { maxTokens: 32, temperature: 0, onEvent: event => events.push(event.type) })
    expect(result).toMatchObject({ provider: 'nvidia', model: 'meta/llama-instruct', content: '{"ok":true}' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(events).toContain('fallback')
  })

  test('forwards credentials only as a transient authorization header and sanitizes errors', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'invalid sk-super-secret' } }), { status: 401 }))
    vi.stubGlobal('fetch', upstream)
    const result = await proxyAIRequest({ action: 'models', provider: 'openai' }, 'sk-super-secret')
    expect(result.status).toBe(401)
    expect(JSON.stringify(result.body)).not.toContain('sk-super-secret')
    const init = upstream.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-super-secret')
    expect(init.body).toBeUndefined()
    expect(result.headers['Cache-Control']).toBe('no-store')
  })

  test('rejects cross-origin, malformed, and SSRF-shaped gateway requests before fetch', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    const crossOrigin = await handleAIRequest(
      { action: 'models', provider: 'openai' },
      {
        apiKey: 'sk-test', origin: 'https://attacker.example', host: 'doclense.example',
        contentType: 'application/json', fetchSite: 'cross-site', requestMarker: '1', clientId: 'cross-origin-test',
      },
    )
    const ssrf = await proxyAIRequest({ action: 'models', provider: 'http://169.254.169.254/latest/meta-data' }, 'sk-test')
    const credentialInBody = await proxyAIRequest({ action: 'models', provider: 'openai', apiKey: 'sk-leak' }, 'sk-test')
    expect(crossOrigin.status).toBe(403)
    expect(ssrf.status).toBe(400)
    expect(credentialInBody.status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  test('rejects request manipulation and forwards only the strict chat schema', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', upstream)
    const manipulated = await proxyAIRequest({
      action: 'chat', provider: 'groq',
      payload: { ...validChatPayload, stream: true, user: 'victim', max_tokens: 100_000 },
    }, 'gsk-test')
    expect(manipulated.status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()

    const allowed = await proxyAIRequest({ action: 'chat', provider: 'groq', payload: validChatPayload }, 'gsk-test')
    expect(allowed.status).toBe(200)
    const forwarded = JSON.parse(String((upstream.mock.calls[0][1] as RequestInit).body))
    expect(forwarded).toEqual(validChatPayload)
    expect(forwarded).not.toHaveProperty('stream')
    expect(forwarded).not.toHaveProperty('user')
  })

  test('bounds oversized and stalled upstream responses without leaking provider data', async () => {
    const oversized = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200, headers: { 'content-length': '6000000' } }))
    vi.stubGlobal('fetch', oversized)
    await expect(proxyAIRequest({ action: 'models', provider: 'openai' }, 'sk-test')).resolves.toMatchObject({ status: 502 })

    vi.useFakeTimers()
    const stalled = vi.fn().mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    vi.stubGlobal('fetch', stalled)
    const request = proxyAIRequest({ action: 'models', provider: 'openai' }, 'sk-test')
    await vi.advanceTimersByTimeAsync(45_000)
    await expect(request).resolves.toMatchObject({ status: 504 })
  })
})

