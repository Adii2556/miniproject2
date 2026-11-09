import { describe, expect, test } from 'vitest'
import { buildDownloadMarkdown, buildDownloadText, sanitizeFileName } from '../src/lib/analysis'
import { computeStats } from '../src/lib/stats'
import type { AnalysisResult } from '../src/lib/groq'

const citation = { sourceId: 'doc:p1', documentId: 'doc', documentName: 'paper.pdf', label: 'paper.pdf · Page 1', excerpt: 'Exact source evidence.', status: 'verified' as const, supportScore: 0.8 }
const result: Partial<AnalysisResult> = {
  title: 'Evidence report',
  oneLiner: 'A tested report.',
  summary: { text: 'Exact source evidence supports the result.', citations: [citation], evidenceStatus: 'verified' },
  coverage: { mode: 'complete', totalChunks: 1, analyzedChunkIds: ['doc:chunk-1'], analyzedSourceIds: ['doc:p1'], labels: ['paper.pdf · Page 1'], percent: 100, estimatedRequests: 1, omittedChunks: 0, budget: { mode: 'complete', maxChunks: 8, maxRequests: 6, concurrency: 2 } },
}
const generated = { summary: true, keyPoints: false, keywords: false, sentiment: false, quiz: false }

describe('professional report exports', () => {
  test('includes coverage, evidence markers, and safety language in TXT and Markdown', () => {
    const stats = computeStats('Exact source evidence.')
    const text = buildDownloadText(['paper.pdf'], result, stats, generated)
    const markdown = buildDownloadMarkdown(['paper.pdf'], result, stats, generated)
    expect(text).toContain('100% source coverage')
    expect(text).toContain('[1] paper.pdf · Page 1')
    expect(text).toContain('verify important conclusions')
    expect(markdown).toContain('## Source evidence')
    expect(markdown).toContain('Exact source evidence')
  })

  test('sanitizes paths and reserved punctuation from download names', () => {
    expect(sanitizeFileName('../../private:report?.pdf')).toBe('private_report_')
  })
})
