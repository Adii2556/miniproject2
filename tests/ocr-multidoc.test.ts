import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildCollectionChunks, buildCoverage, createPdfDocument, createTextDocument, validateCitations } from '../src/lib/document'
import { OCR_MAX_PAGES, OCR_MAX_PIXELS, OCR_TIMEOUT_MS } from '../src/lib/ocr'
import { buildDownloadMarkdown } from '../src/lib/analysis'

describe('scanned PDF and multi-document intelligence', () => {
  test('preserves an empty page block so the UI can offer OCR', () => {
    const scanned = createPdfDocument('scanned.pdf', ['   '], 'scan-1')
    expect(scanned.fullText.trim()).toBe('')
    expect(scanned.blocks).toHaveLength(1)
    expect(scanned.blocks[0].label).toBe('scanned.pdf · Page 1')
  })

  test('bounds OCR and uses only same-origin packaged assets', () => {
    expect(OCR_MAX_PAGES).toBe(10)
    expect(OCR_MAX_PIXELS).toBe(2_500_000)
    expect(OCR_TIMEOUT_MS).toBe(180_000)
    const source = readFileSync(join(__dirname, '..', 'src/lib/ocr.ts'), 'utf8')
    expect(source).toContain("workerPath: '/ocr/worker.min.js'")
    expect(source).toContain("langPath: '/ocr'")
    expect(source).not.toMatch(/https?:\/\//)
  })

  test('preserves document provenance through chunking and coverage', () => {
    const documents = [
      createTextDocument('Revenue grew by 24 percent.', 'Q3_Report.txt', 'doc-1'),
      createTextDocument('Guidance increased by 15 percent.', 'Forecast.txt', 'doc-2'),
    ]
    const chunks = buildCollectionChunks(documents)
    expect(chunks).toHaveLength(2)
    expect(chunks[0].text).toContain('SOURCE doc-1:para-1 (Q3_Report.txt · Paragraph 1)')
    expect(chunks[1].text).toContain('SOURCE doc-2:para-1 (Forecast.txt · Paragraph 1)')
    const coverage = buildCoverage(chunks, chunks, { mode: 'complete', maxChunks: 2 })
    expect(coverage.percent).toBe(100)
    expect(coverage.labels.join(' ')).toContain('Q3_Report.txt')
    expect(coverage.labels.join(' ')).toContain('Forecast.txt')
  })

  test('validates exact citations independently across documents', () => {
    const documents = [
      createTextDocument('Primary study: 85 percent efficacy observed.', 'Study_A.txt', 'doc-1'),
      createTextDocument('Secondary trial: confirmatory evidence verified.', 'Study_B.txt', 'doc-2'),
    ]
    const citations = validateCitations([
      { sourceId: 'doc-1:para-1', excerpt: '85 percent efficacy observed' },
      { sourceId: 'doc-2:para-1', excerpt: 'confirmatory evidence verified' },
      { sourceId: 'doc-1:para-1', excerpt: 'fabricated result' },
    ], documents, 'The studies found 85 percent efficacy and confirmatory evidence.')
    expect(citations).toHaveLength(2)
    expect(citations.map(citation => citation.documentName)).toEqual(['Study_A.txt', 'Study_B.txt'])
  })

  test('includes distinct source provenance in Markdown reports', () => {
    const citations = [
      { sourceId: 'a:p1', documentId: 'a', documentName: 'Study_A.pdf', label: 'Study_A.pdf · Page 1', excerpt: 'efficacy observed', supportScore: 0.8, status: 'verified' as const },
      { sourceId: 'b:p2', documentId: 'b', documentName: 'Study_B.pdf', label: 'Study_B.pdf · Page 2', excerpt: 'evidence verified', supportScore: 0.7, status: 'verified' as const },
    ]
    const markdown = buildDownloadMarkdown(['Study_A.pdf', 'Study_B.pdf'], {
      title: 'Comparative analysis',
      summary: { text: 'Both studies report evidence.', citations, evidenceStatus: 'verified' },
    }, {
      words: 200, characters: 1200, charactersNoSpaces: 1000, sentences: 10, paragraphs: 4,
      readingMinutes: 1, avgWordsPerSentence: 20, lexiconDiversity: 0.75, readingTimeLabel: '1 min',
    }, { summary: true, keyPoints: false, keywords: false, sentiment: false, quiz: false })
    expect(markdown).toContain('**Sources:** Study_A.pdf,  Study_B.pdf')
    expect(markdown).toContain('**Study_A.pdf · Page 1**')
    expect(markdown).toContain('**Study_B.pdf · Page 2**')
  })
})
