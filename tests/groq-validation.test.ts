import { afterEach, describe, expect, test, vi } from 'vitest'
import { callGroq, FriendlyError, type AnalysisSettings } from '../src/lib/groq'
import { createTextDocument } from '../src/lib/document'

const settings: AnalysisSettings = {
  model: 'llama-3.3-70b-versatile',
  temperature: 0.2,
  maxTokens: 512,
  summaryStyle: 'concise',
  language: 'English',
  readingLevel: 'professional',
}

const document = createTextDocument('Verified evidence establishes the primary conclusion.', 'evidence.txt')
const valid = {
  title: 'Verified Finding',
  oneLiner: 'A source-backed result.',
  summary: {
    text: 'The document establishes the primary conclusion.',
    citations: [{ sourceId: 'para-1', excerpt: 'Verified evidence establishes the primary conclusion.' }],
  },
}

const mockResponse = (content: string | object, status = 200) => new Response(
  status === 200
    ? JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] })
    : JSON.stringify(content),
  { status, headers: { 'Content-Type': 'application/json' } },
)

afterEach(() => vi.unstubAllGlobals())

describe('DocLense Groq Validation and Bounded Retry Policy', () => {
  test('retries one malformed response at temperature zero with structured correction', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => Promise.resolve(mockResponse('not-json')))
      .mockImplementationOnce(() => Promise.resolve(mockResponse(valid)))
    vi.stubGlobal('fetch', fetchMock)

    const result = await callGroq('gsk_test_api_key_123', settings, ['summary'], document)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const retryBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body)) as {
      temperature: number
      messages: Array<{ content: string }>
    }
    expect(retryBody.temperature).toBe(0)
    expect(retryBody.messages.at(-1)?.content).toContain('failed validation')
    expect(result.summary?.citations).toHaveLength(1)
  })

  test('stops safely after exactly two invalid responses without unbounded recursion', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(mockResponse('still-not-json')))
    vi.stubGlobal('fetch', fetchMock)

    await expect(callGroq('gsk_test_api_key_123', settings, ['summary'], document)).rejects.toMatchObject({
      code: 'UNVERIFIED',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test.each([
    [401, 'AUTH'],
    [403, 'AUTH'],
    [429, 'RATE_LIMIT'],
    [503, 'SERVER'],
  ] as const)('does not retry HTTP %s responses', async (status, code) => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(mockResponse({ error: { message: 'rejected' } }, status)))
    vi.stubGlobal('fetch', fetchMock)

    await expect(callGroq('gsk_test_api_key_123', settings, ['summary'], document)).rejects.toMatchObject({ code })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('does not retry ordinary network failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(callGroq('gsk_test_api_key_123', settings, ['summary'], document)).rejects.toMatchObject({
      code: 'NETWORK',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('omits unsupported key points while retaining verified claims', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(mockResponse({
      ...valid,
      keyPoints: [
        { text: 'Verified claim.', citations: [{ sourceId: 'para-1', excerpt: 'primary conclusion' }] },
        { text: 'Fabricated claim.', citations: [{ sourceId: 'para-1', excerpt: 'nonexistent phrase not in text' }] },
      ],
    }))))

    const result = await callGroq('gsk_test_api_key_123', settings, ['summary', 'keyPoints'], document)
    expect(result.keyPoints).toHaveLength(1)
    expect(result.keyPoints?.[0].text).toBe('Verified claim.')
  })

  test('propagates AbortSignal cancellation immediately instead of retrying', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const pending = callGroq('gsk_test_api_key_123', settings, ['summary'], document, controller.signal)
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('exposes typed friendly failure objects', () => {
    const err = new FriendlyError('Key rejected', 'AUTH')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('AUTH')
  })
})
