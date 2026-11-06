import { describe, expect, test } from 'vitest'
import {
  buildCoverage,
  buildDocumentChunks,
  createPdfDocument,
  createTextDocument,
  findCitationRange,
  rankChunksForQuestion,
  selectAnalysisChunks,
  validateCitations,
  type DocumentModel,
} from '../src/lib/document'

describe('DocLense Structured Document Pipeline', () => {
  test('preserves PDF page and text paragraph identities', () => {
    const pdf = createPdfDocument('contract.pdf', ['Section 1: Parties and Scope.', 'Section 2: Payment and Terms.'])
    const text = createTextDocument('Paragraph one.\n\nParagraph two.\n\nParagraph three.', 'notes.txt')

    expect(pdf.blocks).toMatchObject([
      { id: 'p1', label: 'Page 1', pageNumber: 1 },
      { id: 'p2', label: 'Page 2', pageNumber: 2 },
    ])
    expect(text.blocks).toMatchObject([
      { id: 'para-1', paragraphNumber: 1 },
      { id: 'para-2', paragraphNumber: 2 },
      { id: 'para-3', paragraphNumber: 3 },
    ])
  })

  test('builds bounded overlapping chunks and samples six deterministically', () => {
    const document = createTextDocument(
      Array.from({ length: 30 }, (_, index) => `Paragraph ${index + 1} ${'verifiable evidence '.repeat(80)}`).join('\n\n'),
      'long.txt',
    )
    const chunks = buildDocumentChunks(document, 2_000, 200)
    const selected = selectAnalysisChunks(chunks, 6, 'sampled')
    const coverage = buildCoverage(chunks, selected)

    expect(chunks.length).toBeGreaterThan(6)
    expect(selected).toHaveLength(6)
    expect(selected[0]).toBe(chunks[0])
    expect(selected.at(-1)).toBe(chunks.at(-1))
    expect(coverage).toMatchObject({
      mode: 'sampled',
      totalChunks: chunks.length,
      analyzedChunkIds: expect.any(Array),
    })
    expect(coverage.percentage).toBeLessThanOrEqual(100)
  })

  test('complete coverage mode evaluates all sections with 100% coverage', () => {
    const document = createTextDocument(
      Array.from({ length: 15 }, (_, index) => `Chapter ${index + 1}: ${'critical details '.repeat(60)}`).join('\n\n'),
      'full.txt',
    )
    const chunks = buildDocumentChunks(document, 2_000, 100)
    const selected = selectAnalysisChunks(chunks, 6, 'complete')
    const coverage = buildCoverage(chunks, selected)

    expect(coverage.mode).toBe('complete')
    expect(coverage.percentage).toBe(100)
    expect(selected.length).toBe(chunks.length)
  })

  test('ranks relevant chunks using BM25 and includes adjacent context chunk', () => {
    const document = createTextDocument(
      Array.from({ length: 10 }, (_, index) => {
        const topic = index === 6 ? 'Quarterly financial revenue and cloud computing operating margin. ' : `General information section ${index + 1}. `
        return topic + `Supporting metrics and background context ${index + 1}. `.repeat(90)
      }).join('\n\n'),
      'earnings.txt',
    )
    const chunks = buildDocumentChunks(document, 4_000, 100)
    const ranked = rankChunksForQuestion(chunks, 'What were the quarterly cloud computing margins and financial revenue?', 5)

    expect(chunks.length).toBeGreaterThan(5)
    expect(ranked.some(chunk => chunk.text.toLowerCase().includes('cloud computing'))).toBe(true)
    expect(ranked).toHaveLength(5)
    const targetChunk = ranked.find(chunk => chunk.text.toLowerCase().includes('cloud computing'))!
    expect(ranked.some(chunk => Math.abs(chunk.index - targetChunk.index) === 1)).toBe(true)
  })

  test('accepts only exact excerpts that exist in their named source block', () => {
    const document = createTextDocument('Verified source evidence appears on line four.', 'evidence.txt')
    const valid = validateCitations([{ sourceId: 'para-1', excerpt: 'source evidence appears on line four' }], document)
    const invalid = validateCitations([
      { sourceId: 'para-1', excerpt: 'this text was fabricated by AI' },
      { sourceId: 'nonexistent-block', excerpt: 'source evidence' },
    ], document)

    expect(valid).toHaveLength(1)
    expect(valid[0]).toMatchObject({
      sourceId: 'para-1',
      label: 'Paragraph 1',
      excerpt: 'source evidence appears on line four',
      verified: true,
    })
    expect(invalid).toEqual([])

    const range = findCitationRange(document.fullText, 'source evidence appears on line four')
    expect(range).not.toBeNull()
    expect(document.fullText.slice(range!.start, range!.end).toLowerCase()).toBe('source evidence appears on line four')
  })

  test('supports multi-document citation tracking and provenance', () => {
    const docA: DocumentModel = createTextDocument('Agreement between Alice and Bob regarding IP.', 'contractA.txt', 'docA')
    const docB: DocumentModel = createTextDocument('Amendment specifying warranty periods and remedies.', 'contractB.txt', 'docB')

    const citations = [
      { sourceId: 'docA-para-1', excerpt: 'Agreement between Alice and Bob' },
      { sourceId: 'docB-para-1', excerpt: 'warranty periods and remedies' },
    ]

    const validated = validateCitations(citations, [docA, docB])
    expect(validated).toHaveLength(2)
    expect(validated[0].docName).toBe('contractA.txt')
    expect(validated[1].docName).toBe('contractB.txt')
  })
})
