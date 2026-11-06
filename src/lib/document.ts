export interface SourceBlock {
  id: string
  label: string
  text: string
  pageNumber?: number
  paragraphNumber?: number
  docId?: string
  docName?: string
}

export interface DocumentModel {
  id?: string
  fileName: string
  kind: 'PDF' | 'TEXT'
  fullText: string
  blocks: SourceBlock[]
  pageCount: number | null
  isOcr?: boolean
}

export interface DocumentChunk {
  id: string
  index: number
  text: string
  sourceIds: string[]
  labels: string[]
  docId?: string
  docName?: string
}

export interface Citation {
  sourceId: string
  label: string
  excerpt: string
  docId?: string
  docName?: string
  verified?: boolean
}

export interface CitedText {
  text: string
  citations: Citation[]
}

export interface AnalysisCoverage {
  mode: 'complete' | 'sampled'
  totalChunks: number
  analyzedChunkIds: string[]
  labels: string[]
  totalChars: number
  analyzedChars: number
  percentage: number
}

export const CHUNK_TARGET_CHARS = 12_000
export const CHUNK_OVERLAP_CHARS = 600
export const DIRECT_ANALYSIS_MAX_CHARS = 24_000
export const MAX_SAMPLED_CHUNKS = 6
export const MAX_COMPLETE_CHUNKS = 18

export const normalizeBlockText = (text: string): string => text
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

export function createTextDocument(text: string, fileName: string, docId?: string): DocumentModel {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  let paragraphs = normalized.split(/\n\s*\n/).map(normalizeBlockText).filter(Boolean)
  if (paragraphs.length === 1 && normalized.includes('\n')) {
    paragraphs = normalized.split(/\n+/).map(normalizeBlockText).filter(Boolean)
  }
  if (paragraphs.length === 0 && normalized) paragraphs = [normalized]

  const idPrefix = docId ? `${docId}-para` : 'para'
  const blocks = paragraphs.map((paragraph, index): SourceBlock => ({
    id: `${idPrefix}-${index + 1}`,
    label: `Paragraph ${index + 1}`,
    paragraphNumber: index + 1,
    text: paragraph,
    docId,
    docName: fileName,
  }))

  return {
    id: docId,
    fileName,
    kind: 'TEXT',
    fullText: blocks.map(block => block.text).join('\n\n'),
    blocks,
    pageCount: null,
  }
}

export function createPdfDocument(fileName: string, pageTexts: string[], docId?: string, isOcr = false): DocumentModel {
  const idPrefix = docId ? `${docId}-p` : 'p'
  const blocks = pageTexts.map((pageText, index): SourceBlock => ({
    id: `${idPrefix}${index + 1}`,
    label: `Page ${index + 1}`,
    pageNumber: index + 1,
    text: normalizeBlockText(pageText),
    docId,
    docName: fileName,
  }))

  return {
    id: docId,
    fileName,
    kind: 'PDF',
    fullText: blocks.map(block => block.text).join('\n\n'),
    blocks,
    pageCount: pageTexts.length,
    isOcr,
  }
}

export function coerceDocument(input: DocumentModel | string, fileName = 'Document.txt'): DocumentModel {
  return typeof input === 'string' ? createTextDocument(input, fileName) : input
}

interface ChunkPart {
  sourceId: string
  label: string
  text: string
  docId?: string
  docName?: string
}

function splitBlock(block: SourceBlock, maxChars: number): ChunkPart[] {
  if (block.text.length <= maxChars) {
    return [{
      sourceId: block.id,
      label: block.label,
      text: block.text,
      docId: block.docId,
      docName: block.docName,
    }]
  }
  const parts: ChunkPart[] = []
  for (let offset = 0; offset < block.text.length; offset += maxChars) {
    parts.push({
      sourceId: block.id,
      label: block.label,
      text: block.text.slice(offset, offset + maxChars),
      docId: block.docId,
      docName: block.docName,
    })
  }
  return parts
}

const partLength = (part: ChunkPart) => part.text.length + part.label.length + part.sourceId.length + 24

function renderChunk(parts: ChunkPart[], index: number): DocumentChunk {
  const sourceIds = [...new Set(parts.map(part => part.sourceId))]
  const labels = [...new Set(parts.map(part => part.label))]
  const docId = parts[0]?.docId
  const docName = parts[0]?.docName
  const prefix = docId ? `[Doc: ${docName ?? docId}] ` : ''

  return {
    id: `chunk-${index + 1}`,
    index,
    sourceIds,
    labels,
    docId,
    docName,
    text: parts.map(part => `${prefix}SOURCE ${part.sourceId} (${part.label})\n${part.text}`).join('\n\n'),
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
  const atomicParts = document.blocks.flatMap(block => splitBlock(block, safeTarget - 300))
  const chunks: DocumentChunk[] = []
  let current: ChunkPart[] = []
  let currentLength = 0

  for (const part of atomicParts) {
    const length = partLength(part)
    if (current.length > 0 && currentLength + length > safeTarget) {
      chunks.push(renderChunk(current, chunks.length))
      const previous = current.at(-1)
      if (previous && safeOverlap > 0) {
        const overlapText = previous.text.slice(-safeOverlap)
        current = [{ ...previous, text: overlapText }]
        currentLength = partLength(current[0])
      } else {
        current = []
        currentLength = 0
      }
    }
    current.push(part)
    currentLength += length
  }

  if (current.length > 0) chunks.push(renderChunk(current, chunks.length))
  return chunks
}

export function selectAnalysisChunks(
  chunks: DocumentChunk[],
  maxChunks = MAX_SAMPLED_CHUNKS,
  mode: 'complete' | 'sampled' = 'sampled',
): DocumentChunk[] {
  if (mode === 'complete') {
    return chunks.slice(0, MAX_COMPLETE_CHUNKS)
  }
  if (chunks.length <= maxChunks) return [...chunks]
  const indexes = new Set<number>([0, chunks.length - 1])
  for (let position = 1; position < maxChunks - 1; position++) {
    indexes.add(Math.round((position * (chunks.length - 1)) / (maxChunks - 1)))
  }
  return [...indexes].sort((a, b) => a - b).slice(0, maxChunks).map(index => chunks[index])
}

export function buildCoverage(allChunks: DocumentChunk[], selectedChunks: DocumentChunk[]): AnalysisCoverage {
  const totalChars = allChunks.reduce((acc, c) => acc + c.text.length, 0)
  const analyzedChars = selectedChunks.reduce((acc, c) => acc + c.text.length, 0)
  const percentage = totalChars > 0 ? Math.min(100, Math.round((analyzedChars / totalChars) * 100)) : 100

  return {
    mode: selectedChunks.length === allChunks.length ? 'complete' : 'sampled',
    totalChunks: allChunks.length,
    analyzedChunkIds: selectedChunks.map(chunk => chunk.id),
    labels: selectedChunks.map(chunk => {
      const first = chunk.labels[0]
      const last = chunk.labels.at(-1)
      const doc = chunk.docName ? `[${chunk.docName}] ` : ''
      const range = first && last && first !== last ? `${first}–${last}` : (first ?? chunk.id)
      return `${doc}${range}`
    }),
    totalChars,
    analyzedChars,
    percentage,
  }
}

/** Practical BM25-inspired lexical retrieval with query term weighting & adjacent chunk cohesion */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with',
])

export const extractQueryTerms = (text: string): string[] => {
  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9'-]{1,}/g) ?? []
  return [...new Set(matches.filter(w => !STOP_WORDS.has(w) && w.length > 2))]
}

export function rankChunksForQuestion(chunks: DocumentChunk[], question: string, limit = 5): DocumentChunk[] {
  if (chunks.length <= limit) return [...chunks]
  const terms = extractQueryTerms(question)
  if (terms.length === 0) return chunks.slice(0, limit)

  // Document frequencies for IDF calculation
  const df = new Map<string, number>()
  for (const term of terms) {
    let count = 0
    for (const chunk of chunks) {
      if (chunk.text.toLowerCase().includes(term)) count++
    }
    df.set(term, count)
  }

  const N = chunks.length
  const avgDocLength = chunks.reduce((sum, c) => sum + c.text.length, 0) / Math.max(1, N)
  const k1 = 1.2
  const b = 0.75

  const scored = chunks.map((chunk, index) => {
    const lower = chunk.text.toLowerCase()
    const docLength = chunk.text.length
    let score = 0

    for (const term of terms) {
      const termDf = df.get(term) || 0
      if (termDf === 0) continue
      // IDF
      const idf = Math.log((N - termDf + 0.5) / (termDf + 0.5) + 1)
      
      // Term Frequency
      let tf = 0
      let pos = lower.indexOf(term)
      while (pos !== -1 && tf < 20) {
        tf++
        pos = lower.indexOf(term, pos + term.length)
      }

      // BM25 term score
      const numerator = tf * (k1 + 1)
      const denominator = tf + k1 * (1 - b + b * (docLength / Math.max(1, avgDocLength)))
      score += idf * (numerator / Math.max(0.001, denominator))

      // Boost for exact phrase / consecutive terms if multiple terms
      if (terms.length > 1 && lower.includes(question.toLowerCase().trim())) {
        score += 3.0
      }
    }

    return { chunk, index, score }
  }).sort((a, b) => b.score - a.score || a.index - b.index)

  const chosen = scored.slice(0, Math.min(4, limit)).map(item => item.chunk)
  const chosenIndexes = new Set(chosen.map(chunk => chunk.index))
  const bestIndex = scored[0]?.index ?? 0
  
  // Include adjacent context chunk for narrative continuity
  const adjacentIndex = [bestIndex + 1, bestIndex - 1].find(
    index => index >= 0 && index < chunks.length && !chosenIndexes.has(index)
  )
  if (adjacentIndex !== undefined && chosen.length < limit) {
    chosen.push(chunks[adjacentIndex])
  }
  return chosen.sort((a, b) => a.index - b.index)
}

export function normalizeForCitation(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function validateCitations(
  citations: Array<{ sourceId: string; excerpt: string }>,
  documents: DocumentModel | DocumentModel[],
): Citation[] {
  const docArray = Array.isArray(documents) ? documents : [documents]
  const blocks = new Map<string, SourceBlock>()
  for (const doc of docArray) {
    for (const block of doc.blocks) {
      blocks.set(block.id, block)
    }
  }

  const valid: Citation[] = []
  const seen = new Set<string>()

  for (const candidate of citations) {
    const block = blocks.get(candidate.sourceId)
    const excerpt = candidate.excerpt.trim().slice(0, 600)
    if (!block || excerpt.length < 8) continue
    
    const normBlock = normalizeForCitation(block.text)
    const normExcerpt = normalizeForCitation(excerpt)

    // Verification check: exact substring or relaxed whitespace-insensitive inclusion
    const isVerified = normBlock.includes(normExcerpt)
    if (!isVerified) continue

    const key = `${block.id}:${normExcerpt}`
    if (seen.has(key)) continue
    seen.add(key)

    valid.push({
      sourceId: block.id,
      label: block.label,
      excerpt,
      docId: block.docId,
      docName: block.docName,
      verified: true,
    })
    if (valid.length === 6) break
  }
  return valid
}

export function findCitationRange(source: string, excerpt: string): { start: number; end: number } | null {
  const normalizedSource: string[] = []
  const sourceIndexes: number[] = []
  let previousWasSpace = false
  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    const isSpace = /\s/.test(character)
    if (isSpace) {
      if (previousWasSpace) continue
      normalizedSource.push(' ')
      sourceIndexes.push(index)
      previousWasSpace = true
    } else {
      normalizedSource.push(character.toLowerCase())
      sourceIndexes.push(index)
      previousWasSpace = false
    }
  }
  const needle = normalizeForCitation(excerpt)
  const haystack = normalizedSource.join('').trim()
  const offset = normalizedSource.join('').indexOf(needle)
  if (!needle || offset < 0) return null
  const start = sourceIndexes[offset] ?? 0
  const finalNormalizedIndex = offset + needle.length - 1
  const end = Math.min(source.length, (sourceIndexes[finalNormalizedIndex] ?? start) + 1)
  return haystack.includes(needle) ? { start, end } : null
}
