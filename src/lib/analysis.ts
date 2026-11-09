import type { AnalysisResult } from './groq'
import type { Citation, CitedText } from './document'
import type { DocStats } from './stats'

export interface GeneratedMap {
  summary: boolean
  keyPoints: boolean
  keywords: boolean
  sentiment: boolean
  quiz: boolean
}

export type ExportFormat = 'txt' | 'md' | 'pdf'

export const NOTHING_GENERATED: GeneratedMap = { summary: false, keyPoints: false, keywords: false, sentiment: false, quiz: false }

interface IndexedCitation extends Citation { index: number }

function collectSources(result: Partial<AnalysisResult>): IndexedCitation[] {
  const sourceMap = new Map<string, Citation>()
  const add = (citations: Citation[] | undefined) => {
    for (const citation of citations ?? []) {
      const key = `${citation.sourceId}:${citation.excerpt.replace(/\s+/g, ' ').trim().toLocaleLowerCase()}`
      if (!sourceMap.has(key)) sourceMap.set(key, citation)
    }
  }
  add(result.summary?.citations)
  result.keyPoints?.forEach(point => add(point.citations))
  result.quiz?.forEach(question => add(question.citations))
  return [...sourceMap.values()].map((citation, index) => ({ ...citation, index: index + 1 }))
}

function citationMarkers(value: CitedText, sources: IndexedCitation[]): string {
  const indexes = value.citations.flatMap(citation => {
    const match = sources.find(source => source.sourceId === citation.sourceId && source.excerpt === citation.excerpt)
    return match ? [match.index] : []
  })
  return indexes.length ? ` ${indexes.map(index => `[${index}]`).join('')}` : ''
}

function reportHeader(fileNames: string[]): string[] {
  return [
    'DocLense — Evidence-first document analysis',
    `Sources: ${fileNames.join(', ')}`,
    `Generated: ${new Date().toLocaleString()}`,
  ]
}

export function buildDownloadText(fileNames: string | string[], result: Partial<AnalysisResult>, stats: DocStats, generated: GeneratedMap): string {
  const names = Array.isArray(fileNames) ? fileNames : [fileNames]
  const line = '─'.repeat(72)
  const parts = [...reportHeader(names), line, '']
  const sources = collectSources(result)

  if (result.coverage) {
    parts.push('COVERAGE')
    parts.push(`${result.coverage.mode === 'complete' ? 'Complete' : 'Sampled'} analysis · ${result.coverage.percent}% source coverage · ${result.coverage.analyzedChunkIds.length}/${result.coverage.totalChunks} chunks · up to ${result.coverage.estimatedRequests} API requests`)
    if (result.coverage.omittedChunks > 0) parts.push(`${result.coverage.omittedChunks} chunks were intentionally omitted by the selected budget.`)
    parts.push('', line, '')
  }
  if (generated.summary && result.title) {
    parts.push('TITLE', result.title)
    if (result.oneLiner) parts.push('', result.oneLiner)
    parts.push('', line, '')
  }
  if (generated.summary && result.summary) {
    parts.push('SUMMARY', `${result.summary.text}${citationMarkers(result.summary, sources)}`)
    if (result.summary.evidenceStatus === 'uncertain') parts.push('Evidence note: exact excerpts were found, but local claim-support matching was inconclusive.')
    parts.push('', line, '')
  }
  if (generated.keyPoints && result.keyPoints?.length) {
    parts.push('KEY POINTS')
    result.keyPoints.forEach(point => parts.push(`• ${point.text}${citationMarkers(point, sources)}`))
    parts.push('', line, '')
  }
  if (generated.keywords && result.keywords?.length) parts.push('KEYWORDS', result.keywords.join(' · '), '', line, '')
  if (generated.sentiment && result.sentiment) {
    const sentiment = result.sentiment
    parts.push('SENTIMENT')
    parts.push(`Verdict: ${sentiment.label} (${sentiment.score >= 0 ? '+' : ''}${sentiment.score}/100)`)
    parts.push(`Confidence: ${sentiment.confidence}%`)
    if (sentiment.tones.length) parts.push(`Tones: ${sentiment.tones.join(', ')}`)
    parts.push(`Rationale: ${sentiment.summary}`, '', line, '')
  }
  if (generated.quiz && result.quiz?.length) {
    parts.push('EVIDENCE-GROUNDED QUIZ (ANSWER KEY)')
    result.quiz.forEach((question, index) => {
      const cited: CitedText = { text: '', citations: question.citations, evidenceStatus: 'verified' }
      parts.push('', `Q${index + 1}. ${question.question} [${question.difficulty}]${citationMarkers(cited, sources)}`)
      question.options.forEach((option, optionIndex) => parts.push(`   ${String.fromCharCode(65 + optionIndex)}. ${option}${optionIndex === question.answer ? '  ✓' : ''}`))
      parts.push(`   Explanation: ${question.explanation}`)
    })
    parts.push('', line, '')
  }
  if (sources.length > 0) {
    parts.push('SOURCE EVIDENCE')
    sources.forEach(source => parts.push(`[${source.index}] ${source.label} · ${source.status === 'verified' ? 'verified support' : 'uncertain support'} (${Math.round(source.supportScore * 100)}%)\n“${source.excerpt.replace(/\s+/g, ' ').trim()}”`))
    parts.push('', line, '')
  }
  parts.push('DOCUMENT STATISTICS')
  parts.push(`Words: ${stats.words.toLocaleString()}`)
  parts.push(`Characters: ${stats.characters.toLocaleString()} (${stats.charactersNoSpaces.toLocaleString()} without spaces)`)
  parts.push(`Sentences: ${stats.sentences.toLocaleString()}`)
  parts.push(`Paragraphs: ${stats.paragraphs.toLocaleString()}`)
  parts.push(`Average words per sentence: ${stats.avgWordsPerSentence.toFixed(1)}`)
  parts.push(`Vocabulary diversity: ${(stats.lexiconDiversity * 100).toFixed(0)}%`)
  parts.push(`Reading time: about ${stats.readingTimeLabel} at 225 wpm`)
  parts.push('', 'Generated by DocLense · AI output may be incorrect; verify important conclusions against cited sources.')
  return parts.join('\n')
}

export function buildDownloadMarkdown(fileNames: string | string[], result: Partial<AnalysisResult>, stats: DocStats, generated: GeneratedMap): string {
  const names = Array.isArray(fileNames) ? fileNames : [fileNames]
  const sources = collectSources(result)
  const parts = ['# DocLense evidence-first analysis', '', `**Sources:** ${names.join(',  ')}`, `**Generated:** ${new Date().toLocaleString()}`, '']
  if (result.coverage) {
    parts.push('## Coverage', '', `**${result.coverage.mode === 'complete' ? 'Complete' : 'Sampled'} mode** · ${result.coverage.percent}% source coverage · ${result.coverage.analyzedChunkIds.length}/${result.coverage.totalChunks} chunks · up to ${result.coverage.estimatedRequests} requests`, '')
    if (result.coverage.omittedChunks > 0) parts.push(`> ${result.coverage.omittedChunks} chunks were omitted by the selected budget.`, '')
  }
  if (generated.summary && result.title) parts.push('## Title', '', result.title, '', result.oneLiner ? `> ${result.oneLiner}` : '', '')
  if (generated.summary && result.summary) parts.push('## Summary', '', `${result.summary.text}${citationMarkers(result.summary, sources)}`, '')
  if (generated.keyPoints && result.keyPoints?.length) parts.push('## Key points', '', ...result.keyPoints.map(point => `- ${point.text}${citationMarkers(point, sources)}`), '')
  if (generated.keywords && result.keywords?.length) parts.push('## Keywords', '', result.keywords.map(keyword => `\`${keyword}\``).join(' · '), '')
  if (generated.sentiment && result.sentiment) parts.push('## Sentiment', '', `**${result.sentiment.label}** (${result.sentiment.score >= 0 ? '+' : ''}${result.sentiment.score}/100, ${result.sentiment.confidence}% confidence)`, '', result.sentiment.summary, '')
  if (generated.quiz && result.quiz?.length) {
    parts.push('## Quiz answer key', '')
    result.quiz.forEach((question, index) => {
      const cited: CitedText = { text: '', citations: question.citations, evidenceStatus: 'verified' }
      parts.push(`### ${index + 1}. ${question.question}${citationMarkers(cited, sources)}`, '', ...question.options.map((option, optionIndex) => `- ${optionIndex === question.answer ? '**✓ ' : ''}${option}${optionIndex === question.answer ? '**' : ''}`), '', `*${question.explanation}*`, '')
    })
  }
  if (sources.length > 0) {
    parts.push('## Source evidence', '')
    sources.forEach(source => parts.push(`${source.index}. **${source.label}** — ${source.status === 'verified' ? 'verified support' : 'uncertain support'} (${Math.round(source.supportScore * 100)}%)`, `   > ${source.excerpt.replace(/\s+/g, ' ').trim()}`, ''))
  }
  parts.push('## Document statistics', '', `- Words: ${stats.words.toLocaleString()}`, `- Characters: ${stats.characters.toLocaleString()}`, `- Sentences: ${stats.sentences.toLocaleString()}`, `- Paragraphs: ${stats.paragraphs.toLocaleString()}`, `- Reading time: about ${stats.readingTimeLabel}`, '', '---', '*Generated by DocLense. Verify important conclusions against cited sources.*')
  return parts.filter((value, index, array) => value !== '' || array[index - 1] !== '').join('\n')
}

export function sanitizeFileName(fileName: string): string {
  const last = fileName.split(/[/\\]/).at(-1) || ''
  const base = last.replace(/\.[^.]+$/, '')
  return base.replace(/[/\\?%*:|"<>]/g, '_').replace(/^\.+/, '').trim() || 'document'
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadTextFile(fileName: string, content: string, format: 'txt' | 'md' = 'txt') {
  const base = sanitizeFileName(fileName)
  downloadBlob(`${base}-doclense-analysis.${format}`, new Blob([content], { type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' }))
}

export async function downloadPdfReport(fileName: string, reportText: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const margin = 48
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidth = pageWidth - margin * 2
  let y = margin
  pdf.setProperties({ title: 'DocLense document analysis', subject: 'Evidence-first analysis report', creator: 'DocLense' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  for (const rawLine of reportText.split('\n')) {
    const lines = pdf.splitTextToSize(rawLine || ' ', contentWidth) as string[]
    for (const line of lines) {
      if (y > pageHeight - margin) {
        pdf.addPage()
        y = margin
      }
      pdf.text(line, margin, y)
      y += 14
    }
    y += rawLine ? 2 : 6
  }
  pdf.save(`${sanitizeFileName(fileName)}-doclense-analysis.pdf`)
}
