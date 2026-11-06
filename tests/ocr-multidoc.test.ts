import { describe, expect, test, vi, afterEach } from 'vitest'
import { createPdfDocument, createTextDocument, buildDocumentChunks, buildCoverage, validateCitations } from '../src/lib/document'
import { performBoundedOcr, type OcrProgress } from '../src/lib/ocr'
import { buildDownloadMarkdown } from '../src/lib/analysis'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DocLense Scanned PDF & Multi-Document Intelligence', () => {
  test('flags scanned PDFs and creates bounded OCR page placeholders', () => {
    const scanned = createPdfDocument('scanned_receipt.pdf', ['   '], 'doc-scan-1', true)
    expect(scanned.isOcr).toBe(true)
    expect(scanned.fullText.trim()).toBe('')
    expect(scanned.blocks).toHaveLength(1)
    expect(scanned.blocks[0].label).toBe('Page 1')
  })

  test('performBoundedOcr bounds execution to at most 5 pages and emits progress updates', async () => {
    const progressUpdates: OcrProgress[] = []
    const onProgress = (p: OcrProgress) => progressUpdates.push(p)

    // Mock fetch for Groq Vision transcription
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Invoice #1042 Total: $450.00' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    // Pass a dummy buffer with 8 pages (should bound to 5)
    const dummyBuffer = new ArrayBuffer(100)
    const result = await performBoundedOcr(
      dummyBuffer,
      8, // 8 total pages in scanned PDF
      'gsk_vision_key_123',
      undefined,
      onProgress,
      'doc-ocr-1',
    )

    expect(result.pageCount).toBe(5)
    expect(result.blocks).toHaveLength(5)
    expect(result.accuracyNote).toContain('bounded to first 5 of 8 pages')
    expect(progressUpdates.length).toBeGreaterThan(0)
  })

  test('multi-document chunk builder tags source blocks with document provenance', () => {
    const doc1 = createTextDocument('Quarterly report: Revenue grew by 24% YoY.', 'Q3_Report.txt', 'doc-1')
    const doc2 = createTextDocument('Annual forecast: Guidance increased by 15%.', 'Forecast.txt', 'doc-2')

    const chunks1 = buildDocumentChunks(doc1)
    const chunks2 = buildDocumentChunks(doc2)
    const allChunks = [...chunks1, ...chunks2]

    expect(allChunks).toHaveLength(2)
    expect(allChunks[0].text).toContain('[Doc: Q3_Report.txt]')
    expect(allChunks[1].text).toContain('[Doc: Forecast.txt]')

    const coverage = buildCoverage(allChunks, allChunks)
    expect(coverage.percentage).toBe(100)
    expect(coverage.labels.some(l => l.includes('Q3_Report.txt'))).toBe(true)
    expect(coverage.labels.some(l => l.includes('Forecast.txt'))).toBe(true)
  })

  test('validates citations correctly across multiple disparate documents', () => {
    const doc1 = createTextDocument('Primary study finding: 85% efficacy observed.', 'Study_A.txt', 'doc-1')
    const doc2 = createTextDocument('Secondary trial: Confirmatory evidence verified.', 'Study_B.txt', 'doc-2')

    const candidates = [
      { sourceId: 'doc-1-para-1', excerpt: '85% efficacy observed' },
      { sourceId: 'doc-2-para-1', excerpt: 'Confirmatory evidence verified' },
      { sourceId: 'doc-1-para-1', excerpt: 'Fabricated trial result' },
    ]

    const validated = validateCitations(candidates, [doc1, doc2])
    expect(validated).toHaveLength(2)
    expect(validated[0]).toMatchObject({ docName: 'Study_A.txt', excerpt: '85% efficacy observed', verified: true })
    expect(validated[1]).toMatchObject({ docName: 'Study_B.txt', excerpt: 'Confirmatory evidence verified', verified: true })
  })

  test('multi-document markdown export formats document provenance in footnotes', () => {
    const md = buildDownloadMarkdown(
      'Multi-Doc Comparative Session',
      {
        title: 'Comparative Analysis',
        summary: {
          text: 'Both studies confirm efficacy.',
          citations: [
            { sourceId: 'p1', label: 'Page 1', docName: 'Study_A.pdf', excerpt: 'efficacy observed' },
            { sourceId: 'p2', label: 'Page 2', docName: 'Study_B.pdf', excerpt: 'evidence verified' },
          ],
        },
      },
      { words: 200, characters: 1200, charactersNoSpaces: 1000, sentences: 10, paragraphs: 4, readingMinutes: 1, avgWordsPerSentence: 20, lexiconDiversity: 0.75, readingTimeLabel: '1 min' },
      { summary: true, keyPoints: false, keywords: false, sentiment: false, quiz: false },
    )

    expect(md).toContain('# DocLense Analysis Report: Multi-Doc Comparative Session')
    expect(md).toContain('[^1]: **[Study_A.pdf]** Page 1')
    expect(md).toContain('[^2]: **[Study_B.pdf]** Page 2')
  })
})
