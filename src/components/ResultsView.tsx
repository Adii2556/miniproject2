import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, AlignLeft, ListChecks, Tags, Gauge, Check, Copy, Download,
  Quote, FileBarChart, Hash, Type, WholeWord, FileSignature, Sigma, BookOpenCheck,
  Activity, Languages, CheckCircle2, Layers,
} from 'lucide-react'
import type { AnalysisResult } from '../lib/groq'
import type { DocStats } from '../lib/stats'
import { buildDownloadText, downloadTextFile, type GeneratedMap } from '../lib/analysis'

interface ResultsViewProps {
  fileName: string
  stats: DocStats
  result: Partial<AnalysisResult>
  generated: GeneratedMap
  onToast: (msg: string) => void
}

/** Small Docent avatar bubble used at the head of each chat-style block. */
function DocentAvatar() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-moss text-cream shadow-[0_2px_0_#0e4740] dark:bg-persimmon-dark dark:text-[#2b1206] dark:shadow-[0_2px_0_#b4532a]">
      <svg width="19" height="19" viewBox="0 0 48 48" fill="none" aria-hidden>
        <path d="M8 13c9.4-3 17.6-1.6 24 3.5-8.5 3-16 6.6-24 3.5z" fill="currentColor" opacity="0.95" />
        <path d="M8 27c9.4-3 17.6-1.6 24 3.5-8.5 3-16 6.6-24 3.5z" fill="currentColor" opacity="0.7" />
        <circle cx="39" cy="10" r="3.4" fill="currentColor" />
      </svg>
    </div>
  )
}

function BlockHeader({ icon: Icon, label, accent, onCopy, copied }: { icon: typeof Sparkles; label: string; accent: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${accent}`}><Icon size={13} strokeWidth={2.4} /></span>
        <p className="font-sans text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-ink-soft dark:text-text-dark-soft">{label}</p>
      </div>
      {onCopy && (
        <button onClick={onCopy} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-bold text-ink-soft/90 transition hover:bg-moss-mist hover:text-moss-deep dark:text-text-dark-soft dark:hover:bg-white/5 dark:hover:text-text-dark" aria-label={`Copy ${label}`}>
          {copied ? <Check size={12} className="text-moss dark:text-emerald-400" /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  )
}

const blockAnim = (i: number) => ({ initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] as const } })

export default function ResultsView({ fileName, stats, result, generated, onToast }: ResultsViewProps) {
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
      try { document.execCommand('copy') } catch { /* noop */ }
      document.body.removeChild(ta)
    }
    setCopiedKey(key)
    onToast('Copied to clipboard')
    window.setTimeout(() => setCopiedKey(null), 1600)
  }

  const handleDownload = () => {
    downloadTextFile(fileName, buildDownloadText(fileName, result, stats, generated))
    onToast('Summary downloaded as .txt')
  }

  const summaryText = result.summary ?? ''
  const sentiment = result.sentiment
  const gaugePct = sentiment ? ((Math.max(-100, Math.min(100, sentiment.score)) + 100) / 200) * 100 : 50
  const sentimentColor = !sentiment ? '' : sentiment.score >= 25 ? 'text-moss dark:text-emerald-400' : sentiment.score <= -25 ? 'text-persimmon dark:text-persimmon-dark' : 'text-[#8a5b0e] dark:text-gold-dark'

  let i = 0

  return (
    <div className="space-y-4">
      {/* ---------- SUGGESTED TITLE ---------- */}
      {generated.summary && result.title && (
        <motion.article {...blockAnim(i++)} className="flex gap-3">
          <DocentAvatar />
          <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg border border-moss/20 bg-cream p-5 shadow-sm dark:border-white/10 dark:bg-panel-dark">
            <BlockHeader icon={Sparkles} label="Suggested title" accent="bg-persimmon-mist text-persimmon dark:bg-persimmon-dark/15 dark:text-persimmon-dark" onCopy={() => copy('title', result.title ?? '')} copied={copiedKey === 'title'} />
            <h2 className="mt-2.5 font-serif text-2xl font-semibold leading-snug tracking-tight text-ink dark:text-text-dark sm:text-[1.75rem]">{result.title}</h2>
            {result.oneLiner && <p className="mt-2 flex items-start gap-1.5 font-body text-[15px] italic leading-relaxed text-ink-soft dark:text-text-dark-soft"><Quote size={13} className="mt-1 shrink-0 text-gold" />{result.oneLiner}</p>}
          </div>
        </motion.article>
      )}

      {/* ---------- SUMMARY ---------- */}
      {generated.summary && summaryText && (
        <motion.article {...blockAnim(i++)} className="flex gap-3">
          <DocentAvatar />
          <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg border border-moss/20 bg-cream p-5 shadow-sm dark:border-white/10 dark:bg-panel-dark">
            <BlockHeader icon={AlignLeft} label="Summary" accent="bg-moss-mist text-moss-deep dark:bg-moss/25 dark:text-[#7fd6c2]" onCopy={() => copy('summary', summaryText)} copied={copiedKey === 'summary'} />
            <div className="mt-2.5 space-y-3 font-body text-[15px] leading-[1.75] text-ink dark:text-text-dark/95">
              {summaryText.split(/\n{2,}/).map((para, idx) => <p key={idx} className="whitespace-pre-line">{para}</p>)}
            </div>
          </div>
        </motion.article>
      )}

      {/* ---------- KEY POINTS ---------- */}
      {generated.keyPoints && result.keyPoints && result.keyPoints.length > 0 && (
        <motion.article {...blockAnim(i++)} className="flex gap-3">
          <DocentAvatar />
          <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg border border-moss/20 bg-cream p-5 shadow-sm dark:border-white/10 dark:bg-panel-dark">
            <BlockHeader icon={ListChecks} label={`Key points · ${result.keyPoints.length}`} accent="bg-moss-mist text-moss-deep dark:bg-moss/25 dark:text-[#7fd6c2]" onCopy={() => copy('keypoints', result.keyPoints!.map(p => `• ${p}`).join('\n'))} copied={copiedKey === 'keypoints'} />
            <ol className="mt-3 space-y-2.5">
              {result.keyPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-moss/30 bg-moss-mist font-mono text-[10.5px] font-bold text-moss-deep dark:border-white/15 dark:bg-white/5 dark:text-gold-dark">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="font-body text-[15px] leading-relaxed text-ink dark:text-text-dark/95">{point}</span>
                </li>
              ))}
            </ol>
          </div>
        </motion.article>
      )}

      {/* ---------- KEYWORDS ---------- */}
      {generated.keywords && result.keywords && result.keywords.length > 0 && (
        <motion.article {...blockAnim(i++)} className="flex gap-3">
          <DocentAvatar />
          <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg border border-moss/20 bg-cream p-5 shadow-sm dark:border-white/10 dark:bg-panel-dark">
            <BlockHeader icon={Tags} label={`Keywords · ${result.keywords.length}`} accent="bg-[#f4ead0] text-[#8a5b0e] dark:bg-gold-dark/15 dark:text-gold-dark" onCopy={() => copy('keywords', result.keywords!.join(', '))} copied={copiedKey === 'keywords'} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.keywords!.map(kw => (
                <button
                  key={kw}
                  onClick={() => copy(`kw-${kw}`, kw)}
                  title="Click to copy"
                  className="group rounded-full border border-moss/25 bg-moss-mist/60 px-3 py-1.5 font-sans text-[12px] font-semibold text-moss-deep transition hover:border-moss hover:bg-moss-mist active:scale-95 dark:border-white/12 dark:bg-white/5 dark:text-text-dark-soft dark:hover:border-gold-dark/40 dark:hover:text-gold-dark"
                >
                  {kw}
                  {copiedKey === `kw-${kw}` ? <Check size={10} className="ml-1 inline text-emerald-600 dark:text-emerald-400" /> : <Hash size={9} className="ml-1 inline opacity-40 transition group-hover:opacity-80" />}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[10.5px] font-medium text-ink-soft/80 dark:text-text-dark-soft/70">These same keywords are highlighted in the full-text reader — open it from the document card.</p>
          </div>
        </motion.article>
      )}

      {/* ---------- SENTIMENT ---------- */}
      {generated.sentiment && sentiment && (
        <motion.article {...blockAnim(i++)} className="flex gap-3">
          <DocentAvatar />
          <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg border border-moss/20 bg-cream p-5 shadow-sm dark:border-white/10 dark:bg-panel-dark">
            <BlockHeader icon={Gauge} label="Sentiment" accent="bg-[#e7e3f7] text-[#5246b0] dark:bg-[#8f83ff]/15 dark:text-[#b3a8ff]" onCopy={() => copy('sentiment', `${sentiment.label} (${sentiment.score >= 0 ? '+' : ''}${sentiment.score}, ${sentiment.confidence}% confidence) — ${sentiment.summary}`)} copied={copiedKey === 'sentiment'} />
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-4">
              <div className="min-w-[140px]">
                <p className={`font-display text-4xl font-extrabold tracking-tight ${sentimentColor}`}>{sentiment.score > 0 ? `+${sentiment.score}` : sentiment.score}</p>
                <p className="mt-0.5 font-sans text-[11px] font-extrabold uppercase tracking-widest text-ink-soft dark:text-text-dark-soft">{sentiment.label}</p>
              </div>
              <div className="min-w-[220px] flex-1">
                <div className="flex items-center justify-between text-[9.5px] font-extrabold uppercase tracking-widest text-ink-soft/70 dark:text-text-dark-soft/70"><span>Negative</span><span>Neutral</span><span>Positive</span></div>
                <div className="relative mt-1.5 h-3.5 rounded-full" style={{ background: 'linear-gradient(90deg,#e8572a 0%,#e9b44c 38%,#efe9d8 50%,#8fc1a9 62%,#175e54 100%)' }}>
                  <div className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink/80 bg-cream shadow-md transition-all duration-700 dark:border-text-dark dark:bg-panel-dark" style={{ left: `${gaugePct}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/25 bg-moss-mist px-2.5 py-1 text-[10.5px] font-bold text-moss-deep dark:border-white/12 dark:bg-white/5 dark:text-text-dark-soft"><Activity size={11} />{sentiment.confidence}% confident</span>
                  {sentiment.tones.map(t => <span key={t} className="rounded-full border border-[#5246b0]/25 bg-[#e7e3f7] px-2.5 py-1 text-[10.5px] font-bold text-[#5246b0] dark:border-[#8f83ff]/25 dark:bg-[#8f83ff]/10 dark:text-[#b3a8ff]">{t}</span>)}
                </div>
              </div>
            </div>
            <p className="mt-3 border-t border-moss/15 pt-3 font-body text-[14.5px] italic leading-relaxed text-ink-soft dark:border-white/10 dark:text-text-dark-soft">{sentiment.summary}</p>
          </div>
        </motion.article>
      )}

      {/* ---------- DOWNLOAD ROW ---------- */}
      <motion.div {...blockAnim(i++)} className="flex flex-wrap items-center gap-2 pl-12">
        <button onClick={handleDownload} className="inline-flex items-center gap-2 rounded-2xl bg-moss px-5 py-3 font-sans text-sm font-bold text-cream shadow-[0_3px_0_#0e4740] transition hover:bg-moss-deep active:translate-y-0.5 active:shadow-none dark:bg-persimmon-dark dark:text-[#2b1206] dark:shadow-[0_3px_0_#b4532a] dark:hover:bg-persimmon">
          <Download size={16} strokeWidth={2.4} /> Download summary (.txt)
        </button>
        <button onClick={() => copy('full', buildDownloadText(fileName, result, stats, generated))} className="inline-flex items-center gap-2 rounded-2xl border-2 border-moss/25 px-4 py-[10px] font-sans text-sm font-bold text-moss-deep transition hover:border-moss hover:bg-moss-mist dark:border-white/15 dark:text-text-dark dark:hover:border-persimmon-dark/50 dark:hover:bg-white/5">
          {copiedKey === 'full' ? <Check size={16} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={16} />} {copiedKey === 'full' ? 'Copied!' : 'Copy everything'}
        </button>
      </motion.div>
    </div>
  )
}

/** Grid of raw document statistics — rendered separately so it also shows before analysis. */
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
        <FileBarChart size={14} className="text-persimmon dark:text-persimmon-dark" />
        <p className="font-sans text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-ink-soft dark:text-text-dark-soft">Document statistics</p>
        <span className="rounded-full bg-moss-mist px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-moss-deep dark:bg-white/8 dark:text-text-dark-soft">computed locally</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl border border-moss/15 bg-cream px-3.5 py-3 shadow-sm transition hover:border-moss/30 dark:border-white/10 dark:bg-panel-dark">
            <Icon size={14} className="text-moss dark:text-gold-dark" strokeWidth={2.2} />
            <p className="mt-1.5 font-display text-lg font-extrabold leading-none tracking-tight text-ink dark:text-text-dark">{value}</p>
            <p className="mt-1 text-[9.5px] font-bold uppercase tracking-wider text-ink-soft/80 dark:text-text-dark-soft/80">{label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function GeneratedStamp() {
  return (
    <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft/70 dark:text-text-dark-soft/60">
      <CheckCircle2 size={12} className="text-moss dark:text-emerald-400" /> Analysis complete — pinned to the top for you
    </p>
  )
}
