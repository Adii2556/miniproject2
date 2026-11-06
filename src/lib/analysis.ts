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

export const NOTHING_GENERATED: GeneratedMap = { summary: false, keyPoints: false, keywords: false, sentiment: false, quiz: false }

export function sanitizeFileName(fileName: string): string {
  const parts = fileName.split(/[/\\]/)
  const last = parts[parts.length - 1] || ''
  const base = last.replace(/\.[^.]+$/, '')
  const sanitized = base.replace(/[/\\?%*:|"<>]/g, '_').replace(/^\.+/, '').trim()
  return sanitized || 'document'
}

/** Build the downloadable .txt report with source citations and statistics */
export function buildDownloadText(fileName: string, result: Partial<AnalysisResult>, stats: DocStats, generated: GeneratedMap): string {
  const line = '─'.repeat(64)
  const parts: string[] = []
  const sources: Citation[] = []
  const sourceIndexes = new Map<string, number>()

  const withSources = (value: CitedText | string): string => {
    if (typeof value === 'string') return value
    const markers = value.citations.map(citation => {
      const key = `${citation.sourceId}:${citation.excerpt.replace(/\s+/g, ' ').trim().toLowerCase()}`
      let index = sourceIndexes.get(key)
      if (index === undefined) {
        sources.push(citation)
        index = sources.length
        sourceIndexes.set(key, index)
      }
      return `[${index}]`
    })
    return `${value.text}${markers.length ? ` ${markers.join('')}` : ''}`
  }

  parts.push('DOCLENSE — Document Intelligence Report')
  parts.push(`Source file: ${fileName}`)
  parts.push(`Generated:   ${new Date().toLocaleString()}`)
  if (result.coverage) {
    parts.push(`Coverage:    ${result.coverage.mode === 'complete' ? 'Complete (100%)' : `Sampled (${result.coverage.percentage}%)`}`)
  }
  parts.push(line)
  parts.push('')

  if (generated.summary && result.title) {
    parts.push(`SUGGESTED TITLE`)
    parts.push(result.title)
    if (result.oneLiner) parts.push(`\nIn one line: ${result.oneLiner}`)
    parts.push('')
    parts.push(line)
    parts.push('')
  }
  if (generated.summary && result.summary) {
    parts.push('SUMMARY')
    parts.push(withSources(result.summary))
    parts.push('')
    parts.push(line)
    parts.push('')
  }
  if (generated.keyPoints && result.keyPoints?.length) {
    parts.push('KEY POINTS')
    for (const point of result.keyPoints) parts.push(`•  ${withSources(point)}`)
    parts.push('')
    parts.push(line)
    parts.push('')
  }
  if (generated.keywords && result.keywords?.length) {
    parts.push('KEYWORDS')
    parts.push(result.keywords.join('  ·  '))
    parts.push('')
    parts.push(line)
    parts.push('')
  }
  if (generated.sentiment && result.sentiment) {
    const s = result.sentiment
    parts.push('SENTIMENT ANALYSIS')
    parts.push(`Verdict:    ${s.label} (${s.score >= 0 ? '+' : ''}${s.score} / ±100)`)
    parts.push(`Confidence: ${s.confidence}%`)
    if (s.tones.length) parts.push(`Tones:      ${s.tones.join(', ')}`)
    parts.push(`Summary:    ${s.summary}`)
    parts.push('')
    parts.push(line)
    parts.push('')
  }
  if (generated.quiz && result.quiz?.length) {
    parts.push('QUIZ & ANSWER KEY')
    result.quiz.forEach((q, i) => {
      parts.push(`\nQ${i + 1}. ${q.question}`)
      q.options.forEach((o, j) => parts.push(`   ${String.fromCharCode(65 + j)}. ${o}${j === q.answer ? '   ✓' : ''}`))
      if (q.explanation) parts.push(`   → ${q.explanation}`)
    })
    parts.push('')
    parts.push(line)
    parts.push('')
  }
  if (sources.length > 0) {
    parts.push('VERIFIED SOURCE REFERENCES')
    sources.forEach((citation, index) => {
      const docLabel = citation.docName ? `[${citation.docName}] ` : ''
      parts.push(`[${index + 1}] ${docLabel}${citation.label} — “${citation.excerpt.replace(/\s+/g, ' ').trim()}”`)
    })
    parts.push('')
    parts.push(line)
    parts.push('')
  }
  parts.push('DOCUMENT STATS')
  parts.push(`Words:                ${stats.words.toLocaleString()}`)
  parts.push(`Characters:           ${stats.characters.toLocaleString()} (${stats.charactersNoSpaces.toLocaleString()} without spaces)`)
  parts.push(`Sentences:            ${stats.sentences.toLocaleString()}`)
  parts.push(`Paragraphs:           ${stats.paragraphs.toLocaleString()}`)
  parts.push(`Avg words / sentence: ${stats.avgWordsPerSentence.toFixed(1)}`)
  parts.push(`Vocabulary diversity: ${(stats.lexiconDiversity * 100).toFixed(0)}%`)
  parts.push(`Reading time:         ~${stats.readingTimeLabel} (at 225 wpm)`)
  parts.push('')
  parts.push('Analyzed with DocLense · powered by Groq — console.groq.com')
  return parts.join('\n')
}

/** Build rich Markdown report with formatting, citations, and stats tables */
export function buildDownloadMarkdown(fileName: string, result: Partial<AnalysisResult>, stats: DocStats, generated: GeneratedMap): string {
  const parts: string[] = []
  const sources: Citation[] = []
  const sourceIndexes = new Map<string, number>()

  const withSources = (value: CitedText | string): string => {
    if (typeof value === 'string') return value
    const markers = value.citations.map(citation => {
      const key = `${citation.sourceId}:${citation.excerpt.replace(/\s+/g, ' ').trim().toLowerCase()}`
      let index = sourceIndexes.get(key)
      if (index === undefined) {
        sources.push(citation)
        index = sources.length
        sourceIndexes.set(key, index)
      }
      return `[^${index}]`
    })
    return `${value.text}${markers.length ? ` ${markers.join('')}` : ''}`
  }

  parts.push(`# DocLense Analysis Report: ${fileName}`)
  parts.push(`*Generated on ${new Date().toLocaleString()}*\n`)
  if (result.coverage) {
    parts.push(`> **Analysis Coverage:** ${result.coverage.mode === 'complete' ? 'Complete (100%)' : `Sampled (${result.coverage.percentage}% of document)`}\n`)
  }

  if (generated.summary && result.title) {
    parts.push(`## ${result.title}\n`)
    if (result.oneLiner) parts.push(`> *${result.oneLiner}*\n`)
  }
  if (generated.summary && result.summary) {
    parts.push(`### Executive Summary\n\n${withSources(result.summary)}\n`)
  }
  if (generated.keyPoints && result.keyPoints?.length) {
    parts.push(`### Key Takeaways\n`)
    for (const point of result.keyPoints) {
      parts.push(`- ${withSources(point)}`)
    }
    parts.push('')
  }
  if (generated.keywords && result.keywords?.length) {
    parts.push(`### Keywords & Topics\n`)
    parts.push(result.keywords.map(kw => `\`${kw}\``).join(' ') + '\n')
  }
  if (generated.sentiment && result.sentiment) {
    const s = result.sentiment
    parts.push(`### Sentiment Analysis\n`)
    parts.push(`- **Tone:** ${s.label} (${s.score >= 0 ? '+' : ''}${s.score} / 100)`)
    parts.push(`- **Confidence:** ${s.confidence}%`)
    if (s.tones.length) parts.push(`- **Dominant Tones:** ${s.tones.join(', ')}`)
    parts.push(`- **Rationale:** ${s.summary}\n`)
  }
  if (generated.quiz && result.quiz?.length) {
    parts.push(`### Verification Quiz\n`)
    result.quiz.forEach((q, i) => {
      parts.push(`**${i + 1}. ${q.question}**\n`)
      q.options.forEach((opt, j) => {
        parts.push(`- [${j === q.answer ? 'x' : ' '}] ${String.fromCharCode(65 + j)}. ${opt}`)
      })
      if (q.explanation) parts.push(`\n*Explanation:* ${q.explanation}\n`)
    })
  }

  parts.push(`### Document Statistics\n`)
  parts.push(`| Metric | Value |`)
  parts.push(`| :--- | :--- |`)
  parts.push(`| Total Words | ${stats.words.toLocaleString()} |`)
  parts.push(`| Total Characters | ${stats.characters.toLocaleString()} |`)
  parts.push(`| Paragraphs | ${stats.paragraphs.toLocaleString()} |`)
  parts.push(`| Sentences | ${stats.sentences.toLocaleString()} |`)
  parts.push(`| Avg. Words / Sentence | ${stats.avgWordsPerSentence.toFixed(1)} |`)
  parts.push(`| Lexical Diversity | ${(stats.lexiconDiversity * 100).toFixed(0)}% |`)
  parts.push(`| Estimated Reading Time | ~${stats.readingTimeLabel} |\n`)

  if (sources.length > 0) {
    parts.push(`### References & Citations\n`)
    sources.forEach((citation, idx) => {
      const docLabel = citation.docName ? `**[${citation.docName}]** ` : ''
      parts.push(`[^${idx + 1}]: ${docLabel}${citation.label} — "${citation.excerpt.replace(/\s+/g, ' ').trim()}"`)
    })
    parts.push('')
  }

  parts.push(`---\n*Report generated by DocLense.*`)
  return parts.join('\n')
}

export function downloadTextFile(fileName: string, content: string) {
  const base = sanitizeFileName(fileName)
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${base}-doclense-analysis.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadMarkdownFile(fileName: string, content: string) {
  const base = sanitizeFileName(fileName)
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${base}-doclense-analysis.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Print-ready HTML document for instant professional PDF saving via browser print */
export function openPrintableReport(fileName: string, result: Partial<AnalysisResult>, stats: DocStats, generated: GeneratedMap) {
  const textContent = buildDownloadText(fileName, result, stats, generated)
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const title = result.title || fileName
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>${sanitizeFileName(title)} - DocLense Report</title>
      <style>
        body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, sans-serif; line-height: 1.6; color: #1a202c; max-width: 800px; margin: 40px auto; padding: 0 20px; }
        h1 { color: #0d4d44; border-bottom: 2px solid #0d4d44; padding-bottom: 8px; margin-bottom: 12px; }
        .meta { color: #718096; font-size: 13px; margin-bottom: 24px; }
        pre { white-space: pre-wrap; font-family: inherit; font-size: 14.5px; background: #f7fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; }
        @media print { body { margin: 20px; } pre { border: none; padding: 0; background: transparent; } button { display: none; } }
      </style>
    </head>
    <body>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h1>DocLense Analysis Report</h1>
        <button onclick="window.print()" style="background: #0d4d44; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer;">Print / Save as PDF</button>
      </div>
      <div class="meta">Source Document: <strong>${fileName}</strong> &bull; Generated: ${new Date().toLocaleString()}</div>
      <pre>${textContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </body>
    </html>
  `)
  printWindow.document.close()
}
