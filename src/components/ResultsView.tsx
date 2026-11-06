import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, AlignLeft, ListChecks, Tags, Gauge, Check, Copy, Download,
  Quote, FileBarChart, Hash, Type, WholeWord, FileSignature, Sigma, BookOpenCheck,
  Activity, Languages, CheckCircle2, Layers, Printer, FileDown,
} from 'lucide-react'
import type { AnalysisResult } from '../lib/groq'
import type { Citation } from '../lib/document'
import type { DocStats } from '../lib/stats'
import {
  buildDownloadText,
  buildDownloadMarkdown,
  downloadTextFile,
  downloadMarkdownFile,
  openPrintableReport,
  type GeneratedMap,
} from '../lib/analysis'
import CitationChips from './CitationChips'

interface ResultsViewProps {
  fileName: string
  stats: DocStats
  result: Partial<AnalysisResult>
  generated: GeneratedMap
  onToast: (msg: string) => void
  onOpenCitation: (citation: Citation) => void
}

/** Small DocLense avatar bubble used at the head of each chat-style block. */
function DocLenseAvatar() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-800 text-cream shadow-[0_2px_0_#064e3b] dark:bg-emerald-600 dark:text-emerald-950 dark:shadow-[0_2px_0_#065f46]">
      <svg width="19" height="19" viewBox="0 0 48 48" fill="none" aria-hidden>
        <path d="M8 13c9.4-3 17.6-1.6 24 3.5-8.5 3-16 6.6-24 3.5z" fill="currentColor" opacity="0.95" />
        <path d="M8 27c9.4-3 17.6-1.6 24 3.5-8.5 3-16 6.6-24 3.5z" fill="currentColor" opacity="0.7" />
        <circle cx="39" cy="10" r="3.4" fill="currentColor" />
      </svg>
    </div>
  )
}

function BlockHeader({
  icon: Icon,
  label,
  accent,
  onCopy,
  copied,
}: {
  icon: typeof Sparkles
  label: string
  accent: string
  onCopy?: () => void
  copied?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${accent}`}>
          <Icon size={13} strokeWidth={2.4} />
        </span>
        <p className="font-sans text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-ink-soft dark:text-text-dark-soft">
          {label}
        </p>
      </div>
      {onCopy && (
        <button
          onClick={onCopy}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-bold text-ink-soft/90 transition hover:bg-moss-mist hover:text-moss-deep dark:text-text-dark-soft dark:hover:bg-white/5 dark:hover:text-text-dark"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={12} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  )
}

const blockAnim = (i: number) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
})

export default function ResultsView({
  fileName,
  stats,
  result,
  generated,
  onToast,
  onOpenCitation,
}: ResultsViewProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        /* noop */
      }
      document.body.removeChild(ta)
    }
    setCopiedKey(key)
    onToast('Copied to clipboard')
    window.setTimeout(() => setCopiedKey(null), 1600)
  }

  const handleDownloadTxt = () => {
    downloadTextFile(fileName, buildDownloadText(fileName, result, stats, generated))
    onToast('Downloaded analysis as .txt')
  }

  const handleDownloadMd = () => {
    downloadMarkdownFile(fileName, buildDownloadMarkdown(fileName, result, stats, generated))
    onToast('Downloaded analysis as .md')
  }

  const handlePrintPdf = () => {
    openPrintableReport(fileName, result, stats, generated)
  }

  const summaryText = result.summary?.text ?? ''
  const sentiment = result.sentiment
  const gaugePct = sentiment ? ((Math.max(-100, Math.min(100, sentiment.score)) + 100) / 200) * 100 : 50
  const sentimentColor = !sentiment
    ? ''
    : sentiment.score >= 25
      ? 'text-emerald-700 dark:text-emerald-400'
      : sentiment.score <= -25
        ? 'text-persimmon dark:text-persimmon-dark'
        : 'text-amber-700 dark:text-amber-400'

  let i = 0

  return (
    <div className="space-y-4">
      {/* Coverage Indicator Banner */}
      {result.coverage ? (
        <motion.aside
          {...blockAnim(i++)}
          className={`rounded-2xl border px-4 py-3 ${
            result.coverage.mode === 'sampled'
              ? 'border-amber-400/50 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-950/20'
              : 'border-emerald-600/30 bg-emerald-50/80 dark:border-emerald-500/25 dark:bg-emerald-950/20'
          }`}
          aria-label="Document analysis coverage"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${result.coverage.mode === 'complete' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <p className="font-sans text-xs font-extrabold text-ink dark:text-text-dark">
                {result.coverage.mode === 'complete'
                  ? 'Complete Document Analysis (100% Coverage)'
                  : `Fast Sampled Analysis (${result.coverage.analyzedChunkIds.length} of ${result.coverage.totalChunks} sections · ~${result.coverage.percentage}% coverage)`}
              </p>
            </div>
            <span className="font-mono text-[10.5px] font-semibold text-ink-soft dark:text-text-dark-soft">
              {result.coverage.analyzedChars.toLocaleString()} of {result.coverage.totalChars.toLocaleString()} chars evaluated
            </span>
          </div>
          <p className="mt-1 text-[11px] font-medium leading-relaxed text-ink-soft dark:text-text-dark-soft">
            {result.coverage.mode === 'complete'
              ? `Evidence verified across all sections: ${result.coverage.labels.join(', ')}.`
              : `Sampled key passages across: ${result.coverage.labels.join(', ')}. Switch to Complete mode in sidebar for full document synthesis.`}
          </p>
        </motion.aside>
      ) : null}

      {/* ---------- SUGGESTED TITLE ---------- */}
      {generated.summary && result.title && (
        <motion.article {...blockAnim(i++)} className="flex gap-3">
          <DocLenseAvatar />
          <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg border border-moss/20 bg-cream p-5 shadow-sm dark:border-white/10 dark:bg-panel-dark">
            <BlockHeader
              icon={Sparkles}
              label="Suggested title"
              accent="bg-persimmon-mist text-persimmon dark:bg-persimmon-dark/15 dark:text-persimmon-dark"
              onCopy={() => copy('title', result.title ?? '')}
              copied={copiedKey === 'title'}
            />
            <h2 className="mt-2.5 font-serif text-2xl font-semibold leading-snug tracking-tight text-ink dark:text-text-dark sm:text-[1.75rem]">
              {result.title}
            </h2>
            {result.oneLiner && (
              <p className="mt-2 flex items-start gap-1.5 font-body text-[15px] italic leading-relaxed text-ink-soft dark:text-text-dark-soft">
                <Quote size={13} className="mt-1 shrink-0 text-amber-500" />
                {result.oneLiner}
              </p>
            )}
          </div>
        </motion.article>
      )}

      {/* ---------- SUMMARY WITH VERIFIABLE CITATIONS ---------- */}
      {generated.summary && summaryText && (
        <motion.article {...blockAnim(i++)} className="flex gap-3">
          <DocLenseAvatar />
          <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg border border-moss/20 bg-cream p-5 shadow-sm dark:border-white/10 dark:bg-panel-dark">
            <BlockHeader
              icon={AlignLeft}
              label="Evidence-Grounded Summary"
              accent="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              onCopy={() => copy('summary', summaryText)}
              copied={copiedKey === 'summary'}
            />
            <div className="mt-2.5 space-y-3 font-body text-[15px] leading-[1.75] text-ink dark:text-text-dark/95">
              {summaryText.split(/\n{2,}/).map((para, idx) => (
                <p key={idx} className="whitespace-pre-line">{para}</p>
              ))}
            </div>
            {result.summary?.citations && result.summary.citations.length > 0 && (
              <div className="mt-3 border-t border-moss/10 pt-2.5 dark:border-white/5">
                <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-ink-soft dark:text-text-dark-soft">
                  Supporting Sources:
                </p>
                <CitationChips citations={result.summary.citations} onOpen={onOpenCitation} />
              </div>
            )}
          </div>
        </motion.article>
      )}

      {/* ---------- KEY POINTS WITH INDIVIDUAL CITATIONS ---------- */}
      {generated.keyPoints && result.keyPoints && result.keyPoints.length > 0 && (
        <motion.article {...blockAnim(i++)} className="flex gap-3">
          <DocLenseAvatar />
          <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg border border-moss/20 bg-cream p-5 shadow-sm dark:border-white/10 dark:bg-panel-dark">
            <BlockHeader
              icon={ListChecks}
              label={`Key points · ${result.keyPoints.length} verified findings`}
              accent="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              onCopy={() => copy('keypoints', result.keyPoints!.map(p => `• ${p.text}`).join('\n'))}
              copied={copiedKey === 'keypoints'}
            />
            <ol className="mt-3 space-y-3">
              {result.keyPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-moss/30 bg-moss-mist font-mono text-[10.5px] font-bold text-moss-deep dark:border-white/15 dark:bg-white/5 dark:text-emerald-400">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-body text-[15px] leading-relaxed text-ink dark:text-text-dark/95">
                      {point.text}
                    </span>
                    <CitationChips citations={point.citations} onOpen={onOpenCitation} className="mt-1.5" />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </motion.article>
      )}

      {/* ---------- KEYWORDS ---------- */}
      {generated.keywords && result.keywords && result.keywords.length > 0 && (
        <motion.article {...blockAnim(i++)} className="flex gap-3">
          <DocLenseAvatar />
          <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg border border-moss/20 bg-cream p-5 shadow-sm dark:border-white/10 dark:bg-panel-dark">
            <BlockHeader
              icon={Tags}
              label={`Keywords · ${result.keywords.length}`}
              accent="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
              onCopy={() => copy('keywords', result.keywords!.join(', '))}
              copied={copiedKey === 'keywords'}
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.keywords!.map(kw => (
                <button
                  key={kw}
                  onClick={() => copy(`kw-${kw}`, kw)}
                  title="Click to copy keyword"
                  className="group rounded-full border border-moss/25 bg-moss-mist/60 px-3 py-1.5 font-sans text-[12px] font-semibold text-moss-deep transition hover:border-moss hover:bg-moss-mist active:scale-95 dark:border-white/12 dark:bg-white/5 dark:text-text-dark-soft dark:hover:border-emerald-500/40 dark:hover:text-emerald-300"
                >
                  {kw}
                  {copiedKey === `kw-${kw}` ? (
                    <Check size={10} className="ml-1 inline text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Hash size={9} className="ml-1 inline opacity-40 transition group-hover:opacity-80" />
                  )}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[10.5px] font-medium text-ink-soft/80 dark:text-text-dark-soft/70">
              Keywords are linked to the document reader — click "View full text" above to inspect them in context.
            </p>
          </div>
        </motion.article>
      )}

      {/* ---------- SENTIMENT ---------- */}
      {generated.sentiment && sentiment && (
        <motion.article {...blockAnim(i++)} className="flex gap-3">
          <DocLenseAvatar />
          <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg border border-moss/20 bg-cream p-5 shadow-sm dark:border-white/10 dark:bg-panel-dark">
            <BlockHeader
              icon={Gauge}
              label="Sentiment Analysis"
              accent="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
              onCopy={() => copy('sentiment', `${sentiment.label} (${sentiment.score >= 0 ? '+' : ''}${sentiment.score}, ${sentiment.confidence}% confidence) — ${sentiment.summary}`)}
              copied={copiedKey === 'sentiment'}
            />
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-4">
              <div className="min-w-[140px]">
                <p className={`font-display text-4xl font-extrabold tracking-tight ${sentimentColor}`}>
                  {sentiment.score > 0 ? `+${sentiment.score}` : sentiment.score}
                </p>
                <p className="mt-0.5 font-sans text-[11px] font-extrabold uppercase tracking-widest text-ink-soft dark:text-text-dark-soft">
                  {sentiment.label}
                </p>
              </div>
              <div className="min-w-[220px] flex-1">
                <div className="flex items-center justify-between text-[9.5px] font-extrabold uppercase tracking-widest text-ink-soft/70 dark:text-text-dark-soft/70">
                  <span>Negative</span><span>Neutral</span><span>Positive</span>
                </div>
                <div className="relative mt-1.5 h-3.5 rounded-full" style={{ background: 'linear-gradient(90deg,#e8572a 0%,#e9b44c 38%,#efe9d8 50%,#8fc1a9 62%,#175e54 100%)' }}>
                  <div
                    className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink/80 bg-cream shadow-md transition-all duration-700 dark:border-text-dark dark:bg-panel-dark"
                    style={{ left: `${gaugePct}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/25 bg-moss-mist px-2.5 py-1 text-[10.5px] font-bold text-moss-deep dark:border-white/12 dark:bg-white/5 dark:text-text-dark-soft">
                    <Activity size={11} />{sentiment.confidence}% confidence
                  </span>
                  {sentiment.tones.map(t => (
                    <span key={t} className="rounded-full border border-indigo-500/25 bg-indigo-50 px-2.5 py-1 text-[10.5px] font-bold text-indigo-800 dark:border-indigo-400/25 dark:bg-indigo-950/40 dark:text-indigo-300">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 border-t border-moss/15 pt-3 font-body text-[14.5px] italic leading-relaxed text-ink-soft dark:border-white/10 dark:text-text-dark-soft">
              {sentiment.summary}
            </p>
          </div>
        </motion.article>
      )}

      {/* ---------- MULTI-FORMAT PROFESSIONAL EXPORT ROW ---------- */}
      <motion.div {...blockAnim(i++)} className="flex flex-wrap items-center gap-2.5 pl-12">
        <button
          onClick={handleDownloadTxt}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-800 px-4 py-2.5 font-sans text-xs font-bold text-cream shadow-[0_3px_0_#064e3b] transition hover:bg-emerald-900 active:translate-y-0.5 active:shadow-none dark:bg-emerald-600 dark:text-emerald-950 dark:shadow-[0_3px_0_#065f46] dark:hover:bg-emerald-500"
          title="Download plain text report with citations"
        >
          <Download size={14} strokeWidth={2.4} /> Download TXT
        </button>

        <button
          onClick={handleDownloadMd}
          className="inline-flex items-center gap-2 rounded-2xl border-2 border-emerald-700/30 bg-emerald-50/50 px-4 py-2 font-sans text-xs font-bold text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
          title="Download structured Markdown report with tables and citations"
        >
          <FileDown size={14} strokeWidth={2.4} /> Markdown (.md)
        </button>

        <button
          onClick={handlePrintPdf}
          className="inline-flex items-center gap-2 rounded-2xl border-2 border-moss/25 px-4 py-2 font-sans text-xs font-bold text-moss-deep transition hover:border-moss hover:bg-moss-mist dark:border-white/15 dark:text-text-dark dark:hover:border-emerald-500/50 dark:hover:bg-white/5"
          title="Open printable document report for saving as PDF"
        >
          <Printer size={14} strokeWidth={2.4} /> Print / Save PDF
        </button>

        <button
          onClick={() => copy('full', buildDownloadText(fileName, result, stats, generated))}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-moss/20 px-3.5 py-2 font-sans text-xs font-semibold text-ink-soft transition hover:bg-moss-mist dark:border-white/10 dark:text-text-dark-soft dark:hover:bg-white/5"
          title="Copy complete analysis to clipboard"
        >
          {copiedKey === 'full' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          <span>{copiedKey === 'full' ? 'Copied All' : 'Copy All'}</span>
        </button>
      </motion.div>
    </div>
  )
}

/** Grid of raw document statistics — computed locally */
export function StatsGrid({ stats }: { stats: DocStats }) {
  const items = [
    { icon: WholeWord, label: 'Words', value: stats.words.toLocaleString() },
    { icon: Type, label: 'Characters', value: stats.characters.toLocaleString() },
    { icon: Hash, label: 'No-space chars', value: stats.charactersNoSpaces.toLocaleString() },
    { icon: FileSignature, label: 'Sentences', value: stats.sentences.toLocaleString() },
    { icon: Layers, label: 'Paragraphs', value: stats.paragraphs.toLocaleString() },
    { icon: BookOpenCheck, label: 'Reading time', value: `~${stats.readingTimeLabel}` },
    { icon: Sigma, label: 'Words / sentence', value: stats.avgWordsPerSentence.toFixed(1) },
    { icon: Languages, label: 'Vocabulary diversity', value: `${Math.round(stats.lexiconDiversity * 100)}%` },
  ]
  return (
    <section aria-label="Document statistics">
      <div className="mb-2.5 flex items-center gap-2 px-1">
        <FileBarChart size={14} className="text-emerald-700 dark:text-emerald-400" />
        <p className="font-sans text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-ink-soft dark:text-text-dark-soft">
          Document statistics
        </p>
        <span className="rounded-full bg-moss-mist px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-moss-deep dark:bg-white/8 dark:text-text-dark-soft">
          computed locally
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="rounded-2xl border border-moss/15 bg-cream px-3.5 py-3 shadow-sm transition hover:border-moss/30 dark:border-white/10 dark:bg-panel-dark"
          >
            <Icon size={14} className="text-moss dark:text-emerald-400" strokeWidth={2.2} />
            <p className="mt-1.5 font-display text-lg font-extrabold leading-none tracking-tight text-ink dark:text-text-dark">
              {value}
            </p>
            <p className="mt-1 text-[9.5px] font-bold uppercase tracking-wider text-ink-soft/80 dark:text-text-dark-soft/80">
              {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function GeneratedStamp() {
  return (
    <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft/70 dark:text-text-dark-soft/60">
      <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
      Analysis complete with verified source citations
    </p>
  )
}
