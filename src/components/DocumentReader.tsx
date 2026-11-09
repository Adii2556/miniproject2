import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, CircleHelp, FileText, Highlighter, X } from 'lucide-react'
import { findCitationRange, type Citation, type DocumentModel, type SourceBlock } from '../lib/document'
import { highlightMatches } from '../lib/stats'

interface DocumentReaderProps {
  documents: DocumentModel[]
  open: boolean
  activeCitation: Citation | null
  keywords: string[]
  highlightKeywords: boolean
  onToggleKeywords: () => void
  onClose: () => void
}

function KeywordText({ text, keywords, enabled }: { text: string; keywords: string[]; enabled: boolean }) {
  if (!enabled) return text
  return highlightMatches(text, keywords).map((part, index) => part.highlight
    ? <mark key={index} className="kw-highlight">{part.text}</mark>
    : <span key={index}>{part.text}</span>)
}

function SourceText({ block, citation, keywords, highlightKeywords }: { block: SourceBlock; citation: Citation | null; keywords: string[]; highlightKeywords: boolean }) {
  const range = citation ? findCitationRange(block.text, citation.excerpt) : null
  if (!range) return <KeywordText text={block.text} keywords={keywords} enabled={highlightKeywords} />
  return (
    <>
      <KeywordText text={block.text.slice(0, range.start)} keywords={keywords} enabled={highlightKeywords} />
      <mark className="rounded bg-persimmon/20 px-0.5 text-inherit ring-2 ring-persimmon/45 dark:bg-persimmon-dark/20 dark:ring-persimmon-dark/50">
        {block.text.slice(range.start, range.end)}
      </mark>
      <KeywordText text={block.text.slice(range.end)} keywords={keywords} enabled={highlightKeywords} />
    </>
  )
}

export default function DocumentReader({ documents, open, activeCitation, keywords, highlightKeywords, onToggleKeywords, onClose }: DocumentReaderProps) {
  const blockRefs = useRef(new Map<string, HTMLElement>())
  const blocks = useMemo(() => documents.flatMap(document => document.blocks), [documents])

  useEffect(() => {
    if (!open || !activeCitation) return
    const frame = window.requestAnimationFrame(() => {
      blockRefs.current.get(activeCitation.sourceId)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, activeCitation])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label="Document evidence reader">
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} className="flex h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-moss/30 bg-cream shadow-2xl dark:border-white/12 dark:bg-panel-dark sm:rounded-3xl" onClick={event => event.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-moss/15 px-5 py-3.5 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText size={17} className="shrink-0 text-moss dark:text-gold-dark" />
                <div className="min-w-0">
                  <p className="truncate font-display text-[13.5px] font-bold text-ink dark:text-text-dark">Evidence reader · {documents.length} {documents.length === 1 ? 'document' : 'documents'}</p>
                  {activeCitation ? (
                    <p className={`mt-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${activeCitation.status === 'verified' ? 'text-moss dark:text-emerald-300' : 'text-[#73500f] dark:text-gold-dark'}`}>
                      {activeCitation.status === 'verified' ? <CheckCircle2 size={11} /> : <CircleHelp size={11} />}
                      {activeCitation.status === 'verified' ? 'Exact quote with matching claim terms' : 'Exact quote; claim support is uncertain'}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={onToggleKeywords} aria-pressed={highlightKeywords} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition ${highlightKeywords ? 'border-gold/50 bg-gold/15 text-[#6b4709] dark:text-gold-dark' : 'border-moss/20 text-ink-soft dark:border-white/12 dark:text-text-dark-soft'}`}>
                  <Highlighter size={13} />Keywords
                </button>
                <button type="button" onClick={onClose} className="rounded-xl p-2 text-ink-soft transition hover:bg-moss-mist hover:text-ink dark:text-text-dark-soft dark:hover:bg-white/5" aria-label="Close reader"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              {blocks.map(block => {
                const selected = activeCitation?.sourceId === block.id
                return (
                  <section
                    key={block.id}
                    ref={element => { if (element) blockRefs.current.set(block.id, element); else blockRefs.current.delete(block.id) }}
                    data-source-id={block.id}
                    className={`rounded-2xl border p-4 transition ${selected ? 'border-persimmon/60 bg-persimmon-mist/30 shadow-sm dark:border-persimmon-dark/60 dark:bg-persimmon-dark/10' : 'border-moss/12 bg-paper/60 dark:border-white/8 dark:bg-white/[0.025]'}`}
                    style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 180px' }}
                  >
                    <h3 className="mb-2 font-sans text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-moss dark:text-gold-dark">{block.label}</h3>
                    {block.text ? (
                      <p className="whitespace-pre-wrap font-body text-[15px] leading-[1.8] text-ink dark:text-text-dark/95">
                        <SourceText block={block} citation={selected ? activeCitation : null} keywords={keywords} highlightKeywords={highlightKeywords} />
                      </p>
                    ) : <p className="text-sm italic text-ink-soft dark:text-text-dark-soft">No selectable text was found on this source page.</p>}
                  </section>
                )
              })}
            </div>
            <div className="border-t border-moss/15 px-5 py-2.5 text-center text-[10.5px] font-semibold text-ink-soft/80 dark:border-white/10 dark:text-text-dark-soft/70">
              {blocks.length.toLocaleString()} source {blocks.length === 1 ? 'section' : 'sections'} · evidence excerpts are matched locally
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
