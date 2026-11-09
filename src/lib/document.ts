export type DocumentKind = 'PDF' | 'TEXT'

export interface SourceBlock {
  id: string
  documentId: string
  documentName: string
  label: string
  text: string
  pageNumber?: number
  paragraphNumber?: number
}

export interface DocumentModel {
  id: string
  fileName: string
  kind: DocumentKind
  fullText: string
  blocks: SourceBlock[]
  pageCount: number | null
}

export interface DocumentChunk {
  id: string
  index: number
  documentId: string
  documentName: string
  text: string
  sourceIds: string[]
  labels: string[]
  tokenEstimate: number
}

export type EvidenceStatus = 'verified' | 'uncertain'

export interface Citation {
  sourceId: string
  documentId: string
  documentName: string
  label: string
  excerpt: string
  status: EvidenceStatus
  supportScore: number
}

export interface CitedText {
  text: string
  citations: Citation[]
  evidenceStatus: EvidenceStatus
}

export type CoverageMode = 'complete' | 'sampled'

export interface AnalysisBudget {
  mode: CoverageMode
  maxChunks: number
  maxRequests: number
  concurrency: number
}

export interface AnalysisCoverage {
  mode: CoverageMode
  totalChunks: number
  analyzedChunkIds: string[]
  analyzedSourceIds: string[]
  labels: string[]
  percent: number
  estimatedRequests: number
  omittedChunks: number
  budget: AnalysisBudget
}

export const CHUNK_TARGET_CHARS = 10_000
export const CHUNK_OVERLAP_CHARS = 700
export const DIRECT_ANALYSIS_MAX_CHARS = 22_000
export const DEFAULT_SAMPLED_CHUNKS = 6
export const DEFAULT_COMPLETE_CHUNKS = 24
export const MAX_COMPLETE_CHUNKS = 40

const normalizeBlockText = (text: string) => text
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

export function stableDocumentId(fileName: string, ordinal = 0): string {
  const base = fileName
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42) || 'document'
  return `${base}-${ordinal + 1}`
}

export function createTextDocument(text: string, fileName: string, id = stableDocumentId(fileName)): DocumentModel {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  let paragraphs = normalized.split(/\n\s*\n/).map(normalizeBlockText).filter(Boolean)
  if (paragraphs.length === 1 && normalized.includes('\n')) {
    paragraphs = normalized.split(/\n+/).map(normalizeBlockText).filter(Boolean)
  }
  if (paragraphs.length === 0 && normalized) paragraphs = [normalized]

  const blocks = paragraphs.map((paragraph, index): SourceBlock => ({
    id: `${id}:para-${index + 1}`,
    documentId: id,
    documentName: fileName,
    label: `${fileName} · Paragraph ${index + 1}`,
    paragraphNumber: index + 1,
    text: paragraph,
  }))

  return {
    id,
    fileName,
    kind: 'TEXT',
    fullText: blocks.map(block => block.text).join('\n\n'),
    blocks,
    pageCount: null,
  }
}

export function createPdfDocument(fileName: string, pageTexts: string[], id = stableDocumentId(fileName)): DocumentModel {
  const blocks = pageTexts.map((pageText, index): SourceBlock => ({
    id: `${id}:p${index + 1}`,
    documentId: id,
    documentName: fileName,
    label: `${fileName} · Page ${index + 1}`,
    pageNumber: index + 1,
    text: normalizeBlockText(pageText),
  }))

  return {
    id,
    fileName,
    kind: 'PDF',
    fullText: blocks.map(block => block.text).join('\n\n'),
    blocks,
    pageCount: pageTexts.length,
  }
}

export function coerceDocuments(input: DocumentModel | DocumentModel[] | string): DocumentModel[] {
  if (typeof input === 'string') return [createTextDocument(input, 'Document.txt')]
  return Array.isArray(input) ? input : [input]
}

interface ChunkPart {
  sourceId: string
  label: string
  text: string
}

function splitBlock(block: SourceBlock, maxChars: number): ChunkPart[] {
  if (block.text.length <= maxChars) return [{ sourceId: block.id, label: block.label, text: block.text }]
  const parts: ChunkPart[] = []
  let offset = 0
  while (offset < block.text.length) {
    const end = Math.min(block.text.length, offset + maxChars)
    let boundary = end
    if (end < block.text.length) {
      const sentenceBoundary = block.text.lastIndexOf('. ', end)
      const lineBoundary = block.text.lastIndexOf('\n', end)
      const candidate = Math.max(sentenceBoundary + 1, lineBoundary)
      if (candidate > offset + Math.floor(maxChars * 0.65)) boundary = candidate
    }
    parts.push({ sourceId: block.id, label: block.label, text: block.text.slice(offset, boundary).trim() })
    offset = boundary
  }
  return parts.filter(part => part.text)
}

const partLength = (part: ChunkPart) => part.text.length + part.label.length + part.sourceId.length + 20

function renderChunk(document: DocumentModel, parts: ChunkPart[], index: number): DocumentChunk {
  const sourceIds = [...new Set(parts.map(part => part.sourceId))]
  const labels = [...new Set(parts.map(part => part.label))]
  const text = parts.map(part => `SOURCE ${part.sourceId} (${part.label})\n${part.text}`).join('\n\n')
  return {
    id: `${document.id}:chunk-${index + 1}`,
    index,
    documentId: document.id,
    documentName: document.fileName,
    sourceIds,
    labels,
    text,
    tokenEstimate: Math.ceil(text.length / 4),
  }
}

export function buildDocumentChunks(
  document: DocumentModel,
  targetChars = CHUNK_TARGET_CHARS,
  overlapChars = CHUNK_OVERLAP_CHARS,
): DocumentChunk[] {
  if (document.blocks.length === 0) return []
  const safeTarget = Math.max(2_000, targetChars)
  const safeOverlap = Math.min(Math.max(0, overlapChars), Math.floor(safeTarget / 3))
  const atomicParts = document.blocks.flatMap(block => splitBlock(block, safeTarget - 400))
  const chunks: DocumentChunk[] = []
  let current: ChunkPart[] = []
  let currentLength = 0

  for (const part of atomicParts) {
    const length = partLength(part)
    if (current.length > 0 && currentLength + length > safeTarget) {
      chunks.push(renderChunk(document, current, chunks.length))
      const previous = current.at(-1)
      if (previous && safeOverlap > 0) {
        current = [{ ...previous, text: previous.text.slice(-safeOverlap) }]
        currentLength = partLength(current[0])
      } else {
        current = []
        currentLength = 0
      }
    }
    current.push(part)
    currentLength += length
  }

  if (current.length > 0) chunks.push(renderChunk(document, current, chunks.length))
  return chunks
}

export function buildCollectionChunks(documents: DocumentModel[]): DocumentChunk[] {
  return documents.flatMap(document => buildDocumentChunks(document))
}

export function selectEvenlySpacedChunks(chunks: DocumentChunk[], maxChunks: number): DocumentChunk[] {
  if (chunks.length <= maxChunks) return [...chunks]
  if (maxChunks <= 1) return [chunks[0]]
  const indexes = new Set<number>()
  for (let position = 0; position < maxChunks; position += 1) {
    indexes.add(Math.round((position * (chunks.length - 1)) / (maxChunks - 1)))
  }
  return [...indexes].sort((a, b) => a - b).map(index => chunks[index])
}

export function selectAnalysisChunks(chunks: DocumentChunk[], budget: AnalysisBudget): DocumentChunk[] {
  const limit = Math.max(1, Math.min(budget.maxChunks, budget.mode === 'complete' ? MAX_COMPLETE_CHUNKS : DEFAULT_COMPLETE_CHUNKS))
  if (budget.mode === 'complete') return chunks.slice(0, limit)

  const byDocument = new Map<string, DocumentChunk[]>()
  for (const chunk of chunks) {
    const group = byDocument.get(chunk.documentId) ?? []
    group.push(chunk)
    byDocument.set(chunk.documentId, group)
  }
  const selected: DocumentChunk[] = []
  const groups = [...byDocument.values()]
  const perDocument = Math.max(1, Math.floor(limit / Math.max(groups.length, 1)))
  for (const group of groups) selected.push(...selectEvenlySpacedChunks(group, perDocument))
  if (selected.length < limit) {
    const chosen = new Set(selected.map(chunk => chunk.id))
    selected.push(...selectEvenlySpacedChunks(chunks.filter(chunk => !chosen.has(chunk.id)), limit - selected.length))
  }
  return selected.slice(0, limit).sort((a, b) => chunks.indexOf(a) - chunks.indexOf(b))
}

export function buildCoverage(allChunks: DocumentChunk[], selectedChunks: DocumentChunk[], budget: AnalysisBudget): AnalysisCoverage {
  const sourceIds = [...new Set(selectedChunks.flatMap(chunk => chunk.sourceIds))]
  const analyzedChunkCount = new Set(selectedChunks.map(chunk => chunk.id)).size
  return {
    mode: budget.mode,
    totalChunks: allChunks.length,
    analyzedChunkIds: selectedChunks.map(chunk => chunk.id),
    analyzedSourceIds: sourceIds,
    labels: selectedChunks.map(chunk => {
      const first = chunk.labels[0]
      const last = chunk.labels.at(-1)
      return first && last && first !== last ? `${first}–${last}` : (first ?? chunk.id)
    }),
    percent: allChunks.length === 0 ? 0 : Math.round((analyzedChunkCount / allChunks.length) * 100),
    estimatedRequests: selectedChunks.length <= 2 ? 1 : Math.ceil(selectedChunks.length / 2) + 1,
    omittedChunks: Math.max(0, allChunks.length - selectedChunks.length),
    budget,
  }
}

const STOP_WORDS = new Set('a an and are as at be been but by can could did do does for from had has have how i if in into is it its may might more most not of on or our should so than that the their them then there these they this those to was we were what when where which who will with would you your'.split(' '))

export function queryTerms(text: string): string[] {
  return [...new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]{1,}/gu) ?? []).filter(term => !STOP_WORDS.has(term)))]
}

function termFrequency(text: string, term: string): number {
  const terms = text.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]{1,}/gu) ?? []
  let count = 0
  for (const value of terms) if (value === term) count += 1
  return count
}

/** Small in-memory BM25-style ranker with phrase and filename boosts. */
export function rankChunksForQuestion(chunks: DocumentChunk[], question: string, limit = 6): DocumentChunk[] {
  if (chunks.length <= limit) return [...chunks]
  const terms = queryTerms(question)
  if (terms.length === 0) return selectEvenlySpacedChunks(chunks, limit)
  const averageLength = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / chunks.length
  const documentFrequency = new Map<string, number>()
  for (const term of terms) {
    documentFrequency.set(term, chunks.filter(chunk => chunk.text.toLocaleLowerCase().includes(term)).length)
  }
  const phrase = terms.join(' ')
  const ranked = chunks.map((chunk, originalIndex) => {
    const lower = chunk.text.toLocaleLowerCase()
    let score = phrase.length > 5 && lower.includes(phrase) ? 6 : 0
    for (const term of terms) {
      const frequency = termFrequency(chunk.text, term)
      if (frequency === 0) continue
      const idf = Math.log(1 + ((chunks.length - (documentFrequency.get(term) ?? 0) + 0.5) / ((documentFrequency.get(term) ?? 0) + 0.5)))
      const normalized = (frequency * 2.2) / (frequency + 1.2 * (0.25 + 0.75 * (chunk.text.length / Math.max(averageLength, 1))))
      score += idf * normalized
      if (chunk.documentName.toLocaleLowerCase().includes(term)) score += 1.5
    }
    return { chunk, originalIndex, score }
  }).sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex)

  const chosen = ranked.slice(0, limit).map(item => item.chunk)
  return chosen.sort((a, b) => chunks.indexOf(a) - chunks.indexOf(b))
}

export function normalizeForCitation(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

export function evidenceSupportScore(claim: string, excerpt: string): number {
  const claimTerms = queryTerms(claim)
  if (claimTerms.length === 0) return 0
  const excerptTerms = new Set(queryTerms(excerpt))
  const overlap = claimTerms.filter(term => excerptTerms.has(term)).length
  const coverage = overlap / claimTerms.length
  const phraseBoost = normalizeForCitation(excerpt).includes(normalizeForCitation(claim).slice(0, 80)) ? 0.2 : 0
  return Math.min(1, Number((coverage + phraseBoost).toFixed(2)))
}

export function validateCitations(
  citations: Array<{ sourceId: string; excerpt: string }>,
  documents: DocumentModel[],
  claimText: string,
): Citation[] {
  const blocks = new Map(documents.flatMap(document => document.blocks).map(block => [block.id, block]))
  const valid: Citation[] = []
  const seen = new Set<string>()

  for (const candidate of citations) {
    const block = blocks.get(candidate.sourceId)
    const excerpt = candidate.excerpt.trim().slice(0, 600)
    if (!block || excerpt.length < 8) continue
    if (!normalizeForCitation(block.text).includes(normalizeForCitation(excerpt))) continue
    const key = `${block.id}:${normalizeForCitation(excerpt)}`
    if (seen.has(key)) continue
    seen.add(key)
    const supportScore = evidenceSupportScore(claimText, excerpt)
    valid.push({
      sourceId: block.id,
      documentId: block.documentId,
      documentName: block.documentName,
      label: block.label,
      excerpt,
      supportScore,
      status: supportScore >= 0.18 ? 'verified' : 'uncertain',
    })
    if (valid.length === 5) break
  }
  return valid
}

export function findCitationRange(source: string, excerpt: string): { start: number; end: number } | null {
  const normalizedSource: string[] = []
  const sourceIndexes: number[] = []
  let previousWasSpace = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const isSpace = /\s/.test(character)
    if (isSpace) {
      if (previousWasSpace) continue
      normalizedSource.push(' ')
      sourceIndexes.push(index)
      previousWasSpace = true
    } else {
      normalizedSource.push(character.toLocaleLowerCase())
      sourceIndexes.push(index)
      previousWasSpace = false
    }
  }
  const needle = normalizeForCitation(excerpt)
  const normalized = normalizedSource.join('')
  const offset = normalized.indexOf(needle)
  if (!needle || offset < 0) return null
  const start = sourceIndexes[offset] ?? 0
  const endIndex = offset + needle.length - 1
  const end = Math.min(source.length, (sourceIndexes[endIndex] ?? start) + 1)
  return { start, end }
}
