import { afterEach, describe, expect, test, vi } from 'vitest'
import { callGroq, type AnalysisSettings } from '../src/lib/groq'
import { createTextDocument } from '../src/lib/document'

const settings: AnalysisSettings = {
  model: 'llama-3.3-70b-versatile',
  temperature: 0.2,
  maxTokens: 512,
  summaryStyle: 'concise',
  language: 'English',
  readingLevel: 'professional',
  analysisMode: 'complete',
  maxChunks: 8,
  quizDifficulty: 'adaptive',
  quizQuestions: 5,
}

const document = createTextDocument('Verified evidence establishes the central finding.', 'evidence.txt')
const sourceId = document.blocks[0].id
const valid = {
  title: 'Verified finding',
  oneLiner: 'A source-backed result.',
  summary: {
    text: 'Verified evidence establishes the central finding.',
    citations: [{ sourceId, excerpt: 'Verified evidence establishes the central finding.' }],
  },
}

const response = (content: string | object, status = 200) => new Response(
  status === 200
    ? JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] })
    : JSON.stringify(content),
  { status, headers: { 'Content-Type': 'application/json' } },
)

afterEach(() => vi.unstubAllGlobals())

describe('Groq schema, evidence, and retry policy', () => {
  test('retries malformed JSON once at temperature zero', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response('not-json'))
      .mockResolvedValueOnce(response(valid))
    vi.stubGlobal('fetch', fetchMock)
    const result = await callGroq('gsk_test', settings, ['summary'], document)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const retryBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body)) as { payload: { temperature: number; messages: Array<{ content: string }> } }
    expect(retryBody.payload.temperature).toBe(0)
    expect(retryBody.payload.messages.at(-1)?.content).toContain('failed validation')
    expect(result.summary?.evidenceStatus).toBe('verified')
  })

  test('repairs a quiz until it contains the selected number of verified questions', async () => {
    const question = (index: number) => ({
      question: `What does the verified evidence establish in item ${index + 1}?`,
      options: ['The central finding', 'An unrelated claim', 'No finding', 'A contradiction'],
      answer: 0,
      explanation: 'Verified evidence establishes the central finding.',
      difficulty: 'easy',
      citations: [{ sourceId, excerpt: 'Verified evidence establishes the central finding.' }],
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ quiz: Array.from({ length: 4 }, (_, index) => question(index)) }))
      .mockResolvedValueOnce(response({ quiz: Array.from({ length: 5 }, (_, index) => question(index)) }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await callGroq('gsk_test', settings, ['quiz'], document)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.quiz).toHaveLength(5)
    const retryBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body)) as { payload: { messages: Array<{ content: string }> } }
    expect(retryBody.payload.messages.at(-1)?.content).toContain('expected exactly 5')
  })

  test('gives mapping and synthesis independent bounded evidence repairs', async () => {
    const large = createTextDocument(`Durable evidence supports the finding. ${'context '.repeat(4_000)}`, 'large-evidence.txt')
    const largeSourceId = large.blocks[0].id
    let call = 0
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      call += 1
      const wrapper = JSON.parse(String(init.body)) as { payload: { messages: Array<{ content: string }>; temperature: number } }
      if (call === 1 || call === 3) return Promise.resolve(response('not-json'))
      if (call === 2) {
        const chunkIds = [...wrapper.payload.messages[1].content.matchAll(/"chunkId":"([^"]+)"/g)].map(match => match[1])
        return Promise.resolve(response({
          digests: chunkIds.map(chunkId => ({
            chunkId,
            overview: 'The source contains durable evidence.',
            claims: [{ text: 'Durable evidence supports the finding.', citations: [{ sourceId: largeSourceId, excerpt: 'Durable evidence supports the finding.' }] }],
            keywords: ['durable evidence'],
          })),
        }))
      }
      return Promise.resolve(response({
        title: 'Durable finding',
        oneLiner: 'The evidence supports the finding.',
        summary: { text: 'Durable evidence supports the finding.', citations: [{ sourceId: largeSourceId, excerpt: 'Durable evidence supports the finding.' }] },
      }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await callGroq('gsk_test', { ...settings, analysisMode: 'sampled', maxChunks: 2, maxTokens: 3_072 }, ['summary'], large)

    expect(fetchMock).toHaveBeenCalledTimes(4)
    const mappingBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as { payload: { max_tokens: number } }
    expect(mappingBody.payload.max_tokens).toBe(1_600)
    for (const index of [1, 3]) {
      const body = JSON.parse(String((fetchMock.mock.calls[index][1] as RequestInit).body)) as { payload: { temperature: number } }
      expect(body.payload.temperature).toBe(0)
    }
    expect(result.summary?.evidenceStatus).toBe('verified')
  })

  test('rejects two unsupported responses without rendering claims', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response({ ...valid, summary: { text: 'Fabricated claim.', citations: [{ sourceId, excerpt: 'not present' }] } }))))
    await expect(callGroq('gsk_test', settings, ['summary'], document)).rejects.toMatchObject({ code: 'UNVERIFIED' })
  })

  test.each([[401, 'AUTH', 1], [429, 'RATE_LIMIT', 3], [503, 'SERVER', 3]] as const)('maps HTTP %s with the bounded retry policy', async (status, code, calls) => {
    const fetchMock = vi.fn().mockResolvedValue(response({ error: { message: 'rejected' } }, status))
    vi.stubGlobal('fetch', fetchMock)
    await expect(callGroq('gsk_test', settings, ['summary'], document)).rejects.toMatchObject({ code })
    expect(fetchMock).toHaveBeenCalledTimes(calls)
  })

  test('propagates user cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })))
    const controller = new AbortController()
    const pending = callGroq('gsk_test', settings, ['summary'], document, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  test('enforces the declared complete-mode budget before making a request', async () => {
    const large = createTextDocument('large source section. '.repeat(25_000), 'large.txt')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(callGroq('gsk_test', { ...settings, maxChunks: 2 }, ['summary'], large)).rejects.toMatchObject({ code: 'TOO_BIG' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
