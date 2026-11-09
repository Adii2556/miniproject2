import { describe, expect, test } from 'vitest'
import {
  buildCollectionChunks,
  buildCoverage,
  buildDocumentChunks,
  createPdfDocument,
  createTextDocument,
  evidenceSupportScore,
  findCitationRange,
  rankChunksForQuestion,
  selectAnalysisChunks,
  validateCitations,
  type AnalysisBudget,
} from '../src/lib/document'

const sampled: AnalysisBudget = { mode: 'sampled', maxChunks: 6, maxRequests: 5, concurrency: 2 }

describe('structured document pipeline', () => {
  test('preserves globally unique PDF page and text paragraph identities', () => {
    const pdf = createPdfDocument('paper.pdf', ['First-page evidence.', 'Second-page conclusion.'])
    const text = createTextDocument('Opening paragraph.\n\nClosing paragraph.', 'notes.txt')

    expect(pdf.blocks[0]).toMatchObject({ documentName: 'paper.pdf', pageNumber: 1 })
    expect(text.blocks[1]).toMatchObject({ documentName: 'notes.txt', paragraphNumber: 2 })
    expect(pdf.blocks[0].id).not.toBe(text.blocks[0].id)
  })

  test('builds bounded overlapping chunks and reports an honest sample', () => {
    const document = createTextDocument(Array.from({ length: 30 }, (_, index) => `Paragraph ${index + 1} ${'evidence '.repeat(80)}`).join('\n\n'), 'long.txt')
    const chunks = buildDocumentChunks(document, 2_000, 200)
    const selected = selectAnalysisChunks(chunks, sampled)
    const coverage = buildCoverage(chunks, selected, sampled)

    expect(chunks.length).toBeGreaterThan(6)
    expect(selected).toHaveLength(6)
    expect(coverage.mode).toBe('sampled')
    expect(coverage.percent).toBeLessThan(100)
    expect(coverage.omittedChunks).toBe(chunks.length - 6)
  })

  test('complete mode refuses to mislabel a truncated budget', () => {
    const document = createTextDocument('section '.repeat(25_000), 'oversized.txt')
    const chunks = buildDocumentChunks(document, 2_000, 100)
    const budget: AnalysisBudget = { mode: 'complete', maxChunks: 4, maxRequests: 4, concurrency: 2 }
    const selected = selectAnalysisChunks(chunks, budget)
    const coverage = buildCoverage(chunks, selected, budget)
    expect(coverage.mode).toBe('complete')
    expect(coverage.percent).toBeLessThan(100)
    expect(coverage.omittedChunks).toBeGreaterThan(0)
  })

  test('BM25-style retrieval separates sources and ranks the relevant passage', () => {
    const finance = createTextDocument('General introduction.\n\nBudget forecasting and cash flow controls are reviewed every Friday.', 'finance.txt')
    const legal = createTextDocument('Contract definitions.\n\nThe termination clause requires thirty days notice.', 'terms.txt')
    const chunks = buildCollectionChunks([finance, legal])
    const ranked = rankChunksForQuestion(chunks, 'When are budget cash flow controls reviewed?', 1)
    expect(ranked[0].documentName).toBe('finance.txt')
    expect(ranked[0].text).toContain('Friday')
  })

  test('requires exact excerpts and distinguishes weak claim support', () => {
    const document = createTextDocument('Revenue increased twelve percent during the quarter.', 'evidence.txt')
    const sourceId = document.blocks[0].id
    const verified = validateCitations([{ sourceId, excerpt: 'Revenue increased twelve percent' }], [document], 'Revenue increased twelve percent.')
    const uncertain = validateCitations([{ sourceId, excerpt: 'during the quarter' }], [document], 'The company acquired a competitor.')
    const fabricated = validateCitations([{ sourceId, excerpt: 'Revenue doubled' }], [document], 'Revenue doubled.')

    expect(verified[0].status).toBe('verified')
    expect(uncertain[0].status).toBe('uncertain')
    expect(fabricated).toEqual([])
    expect(evidenceSupportScore('Revenue increased twelve percent.', verified[0].excerpt)).toBeGreaterThan(0.5)
    expect(findCitationRange(document.fullText, verified[0].excerpt)).not.toBeNull()
  })
})
