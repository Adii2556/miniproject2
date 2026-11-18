import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  discoverProviderModels,
  discoverAndVerifyProviderModels,
  normalizeModelCatalog,
  PROVIDER_REQUEST_TIMEOUT_MS,
  providerErrorCategory,
  runProviderCompletion,
  testProviderModel,
  withModelCompatibility,
  type AIExecutionConfig,
} from '../src/lib/aiProviders'
import { handleAIRequest, proxyAIRequest, UPSTREAM_TIMEOUT_MS } from '../server/aiProxy'

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
const compatibleProbe = {
  compatible: true,
  title: 'Schema check',
  oneLiner: 'All required fields are present.',
  summary: { text: 'Evidence is present.', citations: [{ sourceId: 's1', excerpt: 'Evidence is present.' }] },
  keyPoints: [{ text: 'Evidence is present.', citations: [{ sourceId: 's1', excerpt: 'Evidence is present.' }] }],
  keywords: ['evidence', 'schema'],
  sentiment: { label: 'Neutral', score: 0, confidence: 100, summary: 'The tone is neutral.', tones: ['neutral'] },
  quiz: [{ question: 'What is present?', options: ['Evidence', 'Noise', 'Nothing', 'Unknown'], answer: 0, explanation: 'The source says evidence is present.', difficulty: 'easy', citations: [{ sourceId: 's1', excerpt: 'Evidence is present.' }] }],
  answer: { text: 'Evidence is present.', citations: [{ sourceId: 's1', excerpt: 'Evidence is present.' }] },
  digests: [{ chunkId: 'c1', overview: 'Evidence is present.', claims: [{ text: 'Evidence is present.', citations: [{ sourceId: 's1', excerpt: 'Evidence is present.' }] }], keywords: ['evidence'] }],
}

describe('provider discovery and compatibility', () => {
  test('keeps likely chat models, marks unknown models, and filters known non-text models', () => {
    const models = normalizeModelCatalog('openai', { data: [
      { id: 'meta/llama-3.3-70b-instruct', context_window: 131_072, active: true, type: 'chat' },
      { id: 'nvidia/nemotron-text-model', active: true },
      { id: 'vendor/new-model', active: true },
      { id: 'whisper-large-v3', active: true },
    ] })
    expect(models.find(model => model.id.includes('llama'))).toMatchObject({ compatibility: 'unverified', contextWindow: 131_072 })
    expect(models.find(model => model.id.includes('nemotron'))).toMatchObject({ compatibility: 'unverified' })
    expect(models.find(model => model.id === 'vendor/new-model')).toMatchObject({ compatibility: 'incompatible' })
    expect(models.find(model => model.id.includes('whisper'))).toMatchObject({ compatibility: 'incompatible' })
  })

  test('promotes tested models and blocks failed manual model IDs', () => {
    const promoted = withModelCompatibility([], 'nvidia/current-chat', 'verified', 'Compatibility test passed.')
    expect(promoted[0]).toMatchObject({ id: 'nvidia/current-chat', compatibility: 'verified', structuredJson: true })

    const blocked = withModelCompatibility(promoted, 'nvidia/current-chat', 'incompatible', 'Hosted chat is unavailable.')
    expect(blocked[0]).toMatchObject({ compatibility: 'incompatible', reason: 'Hosted chat is unavailable.' })
  })

  test('discovers account-specific models through the same-origin gateway', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'deepseek-chat', context_window: 128_000 }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const models = await discoverProviderModels('deepseek', 'sk-test')
    expect(models[0]).toMatchObject({ id: 'deepseek-chat', compatibility: 'unverified' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai')
    const request = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(request).toEqual({ action: 'models', provider: 'deepseek' })
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['X-DocLense-Provider-Key']).toBe('sk-test')
    expect(headers['X-DocLense-Request']).toBe('1')
    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe('omit')
  })

  test('exposes only models that pass live DocLense compatibility verification', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { id: 'vendor/active-chat', active: true, context_window: 32_768 },
        { id: 'vendor/retired-chat', active: true, context_window: 32_768 },
        { id: 'whisper-large-v3', active: true, context_window: 448 },
        { id: 'vendor/shutting-down-chat', active: true, shutdown_date: '2026-12-01' },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(compatibleProbe) } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { category: 'model', message: 'Model is not available to this key.' } }), { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await discoverAndVerifyProviderModels('nvidia', 'nvapi-test')

    expect(result.models).toHaveLength(1)
    expect(result.models[0]).toMatchObject({ id: 'vendor/active-chat', compatibility: 'verified', structuredJson: true })
    expect(result.models[0].verifiedAt).toEqual(expect.any(Number))
    expect(result).toMatchObject({ discoveredCount: 4, candidateCount: 2, filteredCount: 2, unavailableCount: 1, pendingCount: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test('keeps rate-limited models pending instead of marking them incompatible', async () => {
    const progress: Array<{ phase: string; checked: number; total: number }> = []
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { id: 'a-chat', active: true },
        { id: 'b-chat', active: true },
        { id: 'c-chat', active: true },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(compatibleProbe) } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { category: 'rate_limit', message: 'Try again later.' } }), { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await discoverAndVerifyProviderModels('groq', 'gsk-test', { onProgress: value => progress.push(value) })

    expect(result.models.map(model => model.id)).toEqual(['a-chat'])
    expect(result).toMatchObject({ temporaryFailureCount: 1, pendingCount: 2, incompatibleCount: 0 })
    expect(progress.at(-1)).toEqual({ phase: 'verifying', checked: 2, total: 3 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test('reports a malformed local key as authentication instead of a network outage', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    let failure: unknown
    try {
      await discoverProviderModels('groq', 'gsk-invalid\u0000key')
    } catch (error) {
      failure = error
    }
    expect(providerErrorCategory(failure)).toBe('auth')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test.each(['groq', 'nvidia', 'deepseek', 'openai'] as const)('reports an invalid %s key as authentication', async provider => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { category: 'auth', message: 'The provider rejected this API key.' },
    }), { status: 401 })))
    await expect(discoverAndVerifyProviderModels(provider, 'invalid-key')).rejects.toMatchObject({ category: 'auth' })
  })

  test('keeps provider outages retryable during discovery', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { category: 'temporary', message: 'The provider is temporarily unavailable.' },
    }), { status: 503 })))
    await expect(discoverAndVerifyProviderModels('openai', 'sk-test')).rejects.toMatchObject({ category: 'temporary' })
  })

  test('sends a gateway-valid lightweight compatibility request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(compatibleProbe) } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await testProviderModel({
      provider: 'nvidia',
      apiKey: 'nvapi-test',
      model: 'nvidia/test-chat-model',
      consent: true,
    })

    const request = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(request).toMatchObject({
      action: 'chat',
      provider: 'nvidia',
      payload: {
        model: 'nvidia/test-chat-model',
        temperature: 0,
        max_tokens: 512,
        top_p: 0.95,
      },
    })
    expect(request.payload).not.toHaveProperty('response_format')
  })

  test('shapes chat parameters for each provider instead of assuming one compatible API', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' } }],
    }), { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)
    const messages = [
      { role: 'system' as const, content: 'Return JSON.' },
      { role: 'user' as const, content: 'Do it.' },
    ]

    const run = (provider: 'groq' | 'nvidia' | 'deepseek' | 'openai', model: string) => runProviderCompletion({
      mode: 'manual', activeProvider: provider, priority: [provider],
      providers: { [provider]: { provider, apiKey: 'test-key', model, consent: true, compatibility: 'verified' } },
    }, messages, { maxTokens: 512, temperature: 0.4 })

    await run('groq', 'openai/gpt-oss-120b')
    await run('nvidia', 'openai/gpt-oss-120b')
    await run('deepseek', 'deepseek-chat')
    await run('openai', 'o3-mini')

    const bodies = fetchMock.mock.calls.map(call => JSON.parse(String((call[1] as RequestInit).body)).payload as Record<string, unknown>)
    expect(bodies[0]).toMatchObject({
      max_completion_tokens: 512,
      reasoning_format: 'hidden',
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
    })
    expect(bodies[0]).not.toHaveProperty('max_tokens')
    expect(bodies[1]).toMatchObject({ max_tokens: 512, reasoning_effort: 'low' })
    expect(bodies[1]).not.toHaveProperty('response_format')
    expect(bodies[2]).toMatchObject({ max_tokens: 512, response_format: { type: 'json_object' } })
    expect(bodies[3]).toMatchObject({
      max_completion_tokens: 512,
      messages: [{ role: 'developer', content: 'Return JSON.' }, { role: 'user', content: 'Do it.' }],
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
    })
    expect(bodies[3]).not.toHaveProperty('max_tokens')
    expect(bodies[3]).not.toHaveProperty('temperature')
    expect(bodies[3]).not.toHaveProperty('top_p')
  })

  test('exposes only the safe provider failure category to compatibility state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { category: 'model', message: 'NVIDIA NIM does not support the selected model for this request.' },
    }), { status: 404 })))
    let failure: unknown
    try {
      await testProviderModel({ provider: 'nvidia', apiKey: 'nvapi-test', model: 'nvidia/retired-model', consent: true })
    } catch (error) {
      failure = error
    }
    expect(providerErrorCategory(failure)).toBe('model')
  })

  test('accepts a compatible JSON object after provider reasoning text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: `Reasoning complete.\n\`\`\`json\n${JSON.stringify(compatibleProbe)}\n\`\`\`` } }],
    }), { status: 200 })))
    await expect(testProviderModel({ provider: 'nvidia', apiKey: 'nvapi-test', model: 'nvidia/reasoning-model', consent: true })).resolves.toBeUndefined()
  })

  test('rejects a probe response that omits real analysis fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"compatible":true,"summary":{"text":"ok","citations":[]}}' } }],
    }), { status: 200 })))
    await expect(testProviderModel({ provider: 'groq', apiKey: 'gsk-test', model: 'weak-chat-model', consent: true })).rejects.toMatchObject({ category: 'output' })
  })

  test('treats a non-JSON probe as retryable instead of permanently blocking the model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Compatible.' } }],
    }), { status: 200 })))
    let failure: unknown
    try {
      await testProviderModel({ provider: 'nvidia', apiKey: 'nvapi-test', model: 'nvidia/plain-text-model', consent: true })
    } catch (error) {
      failure = error
    }
    expect(providerErrorCategory(failure)).toBe('output')
    expect(failure).toMatchObject({ message: 'NVIDIA NIM did not return the required DocLense JSON shape.' })
  })

  test('explains a compatibility probe that exhausts its output budget', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'length', message: { content: '' } }],
    }), { status: 200 })))
    let failure: unknown
    try {
      await testProviderModel({ provider: 'nvidia', apiKey: 'nvapi-test', model: 'nvidia/reasoning-model', consent: true })
    } catch (error) {
      failure = error
    }
    expect(providerErrorCategory(failure)).toBe('output')
    expect(failure).toMatchObject({ message: 'NVIDIA NIM ended verification before returning the required JSON.' })
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
        groq: { provider: 'groq', apiKey: 'gsk-test', model: 'llama-chat', consent: true, compatibility: 'verified' },
        nvidia: { provider: 'nvidia', apiKey: 'nvapi-test', model: 'meta/llama-instruct', consent: true, compatibility: 'verified' },
      },
    }
    const events: string[] = []
    const result = await runProviderCompletion(execution, [{ role: 'user', content: 'Return JSON.' }], { maxTokens: 32, temperature: 0, onEvent: event => events.push(event.type) })
    expect(result).toMatchObject({ provider: 'nvidia', model: 'meta/llama-instruct', content: '{"ok":true}' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(events).toContain('fallback')
  })

  test('falls back after an upstream timeout without repeating the slow provider', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { category: 'temporary', message: 'NVIDIA NIM took too long to respond.' } }), { status: 504 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const execution: AIExecutionConfig = {
      mode: 'automatic', activeProvider: 'nvidia', priority: ['nvidia', 'groq', 'deepseek', 'openai'],
      providers: {
        nvidia: { provider: 'nvidia', apiKey: 'nvapi-test', model: 'nvidia/slow-model', consent: true, compatibility: 'verified' },
        groq: { provider: 'groq', apiKey: 'gsk-test', model: 'llama-chat', consent: true, compatibility: 'verified' },
      },
    }
    const events: string[] = []
    const result = await runProviderCompletion(execution, [{ role: 'user', content: 'Return JSON.' }], { maxTokens: 32, temperature: 0, onEvent: event => events.push(event.type) })
    expect(result.provider).toBe('groq')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(events).toContain('fallback')
    expect(events).not.toContain('retry')
  })

  test('gives a fallback provider a fresh timeout after a stalled request', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const execution: AIExecutionConfig = {
      mode: 'automatic', activeProvider: 'nvidia', priority: ['nvidia', 'deepseek'],
      providers: {
        nvidia: { provider: 'nvidia', apiKey: 'nvapi-test', model: 'nvidia/slow-model', consent: true, compatibility: 'verified' },
        deepseek: { provider: 'deepseek', apiKey: 'sk-test', model: 'deepseek-chat', consent: true, compatibility: 'verified' },
      },
    }
    const request = runProviderCompletion(execution, [{ role: 'user', content: 'Return JSON.' }], { maxTokens: 32, temperature: 0 })
    await vi.advanceTimersByTimeAsync(PROVIDER_REQUEST_TIMEOUT_MS + 1_000)
    await expect(request).resolves.toMatchObject({ provider: 'deepseek', content: '{"ok":true}' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('accepts and forwards the strict provider-specific payload variants', async () => {
    const upstream = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 })))
    vi.stubGlobal('fetch', upstream)
    const messages = [{ role: 'user' as const, content: 'Return JSON.' }]
    const requests = [
      proxyAIRequest({ action: 'chat', provider: 'groq', payload: {
        model: 'openai/gpt-oss-120b', messages, max_completion_tokens: 256, temperature: 0.2,
        top_p: 0.95, response_format: { type: 'json_object' }, reasoning_format: 'hidden', reasoning_effort: 'low',
      } }, 'gsk-test'),
      proxyAIRequest({ action: 'chat', provider: 'nvidia', payload: {
        model: 'openai/gpt-oss-120b', messages, max_tokens: 256, temperature: 0.2, top_p: 0.95, reasoning_effort: 'low',
      } }, 'nvapi-test'),
      proxyAIRequest({ action: 'chat', provider: 'openai', payload: {
        model: 'o3-mini', messages: [{ role: 'developer', content: 'Return JSON.' }, ...messages],
        max_completion_tokens: 256, response_format: { type: 'json_object' }, reasoning_effort: 'low',
      } }, 'sk-test'),
    ]
    await expect(Promise.all(requests)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 200 }),
      expect.objectContaining({ status: 200 }),
      expect.objectContaining({ status: 200 }),
    ]))
    expect(upstream).toHaveBeenCalledTimes(3)
  })

  test('returns structured-output failures to the section recovery layer without duplicate transport retries', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { category: 'output', message: 'Groq could not produce valid structured JSON for this request.' },
      }), { status: 400, headers: { 'Retry-After': '0.001' } }))
    vi.stubGlobal('fetch', fetchMock)
    const execution: AIExecutionConfig = {
      mode: 'manual', activeProvider: 'groq', priority: ['groq'],
      providers: { groq: { provider: 'groq', apiKey: 'gsk-test', model: 'openai/gpt-oss-20b', consent: true, compatibility: 'verified' } },
    }
    await expect(runProviderCompletion(execution, [{ role: 'user', content: 'Return JSON.' }], { maxTokens: 1_600, temperature: 0.2 })).rejects.toMatchObject({ category: 'output' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
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

  test.each([
    ['groq', 'https://api.groq.com/openai/v1/models'],
    ['nvidia', 'https://integrate.api.nvidia.com/v1/models'],
    ['deepseek', 'https://api.deepseek.com/models'],
    ['openai', 'https://api.openai.com/v1/models'],
  ] as const)('uses the official %s discovery endpoint', async (provider, expectedUrl) => {
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    vi.stubGlobal('fetch', upstream)
    await expect(proxyAIRequest({ action: 'models', provider }, 'test-key')).resolves.toMatchObject({ status: 200 })
    expect(upstream.mock.calls[0][0]).toBe(expectedUrl)
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

  test('classifies and sanitizes provider JSON-generation failures', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: 'json_validate_failed',
        message: 'Failed to generate JSON. See failed_generation.',
        failed_generation: 'private document text',
      },
    }), { status: 400 }))
    vi.stubGlobal('fetch', upstream)
    const result = await proxyAIRequest({ action: 'chat', provider: 'groq', payload: validChatPayload }, 'gsk-test')
    expect(result).toMatchObject({
      status: 400,
      body: { error: { category: 'output', message: 'Groq could not produce valid structured JSON for this request.' } },
    })
    expect(JSON.stringify(result.body)).not.toContain('private document text')
  })

  test('classifies a retired provider model as a model error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      detail: 'This model is no longer available.',
    }), { status: 410 })))
    const result = await proxyAIRequest({ action: 'chat', provider: 'nvidia', payload: validChatPayload }, 'nvapi-test')
    expect(result).toMatchObject({
      status: 410,
      body: { error: { category: 'model', message: 'NVIDIA NIM does not support the selected model for this request.' } },
    })
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
    await vi.advanceTimersByTimeAsync(UPSTREAM_TIMEOUT_MS)
    await expect(request).resolves.toMatchObject({ status: 504 })
  })
})

