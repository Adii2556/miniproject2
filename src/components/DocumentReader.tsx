import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FileText, Highlighter, X, Search, Check, Copy } from 'lucide-react'
import { findCitationRange, type Citation, type DocumentModel, type SourceBlock } from '../lib/document'
import { highlightMatches } from '../lib/stats'

interface DocumentReaderProps {
  document: DocumentModel
  open: boolean
  activeCitation: Citation | null
  keywords: string[]
  highlightKeywords: boolean
  onToggleKeywords: () => void
  onClose: () => void
}

function KeywordText({ text, keywords, enabled }: { text: string; keywords: string[]; enabled: boolean }) {
  if (!enabled || keywords.length === 0) return <span>{text}</span>
  return (
    <>
      {highlightMatches(text, keywords).map((part, index) => part.highlight ? (
        <mark key={index} className="rounded bg-amber-200/80 px-0.5 font-medium text-amber-950 dark:bg-amber-400/30 dark:text-amber-200">
          {part.text}
        </mark>
      ) : (
        <span key={index}>{part.text}</span>
      ))}
    </>
  )
}

function SourceText({
  block,
  citation,
  keywords,
  highlightKeywords,
  searchTerm,
}: {
  block: SourceBlock
  citation: Citation | null
  keywords: string[]
  highlightKeywords: boolean
  searchTerm: string
}) {
  const range = citation ? findCitationRange(block.text, citation.excerpt) : null

  // If there's an active citation for this block, highlight the citation excerpt prominently
  if (range) {
    return (
      <>
        <KeywordText text={block.text.slice(0, range.start)} keywords={keywords} enabled={highlightKeywords} />
        <mark className="rounded bg-emerald-300/60 px-1 py-0.5 text-inherit ring-2 ring-emerald-500 font-semibold dark:bg-emerald-700/50 dark:ring-emerald-400">
          {block.text.slice(range.start, range.end)}
        </mark>
        <KeywordText text={block.text.slice(range.end)} keywords={keywords} enabled={highlightKeywords} />
      </>
    )
  }

  // If searching inside reader
  if (searchTerm.trim().length > 1) {
    return (
      <>
        {highlightMatches(block.text, [searchTerm.trim()]).map((part, idx) => part.highlight ? (
          <mark key={idx} className="rounded bg-sky-200 px-1 font-bold text-sky-950 dark:bg-sky-500/40 dark:text-sky-100 ring-1 ring-sky-400">
            {part.text}
          </mark>
        ) : (
          <KeywordText key={idx} text={part.text} keywords={keywords} enabled={highlightKeywords} />
        ))}
      </>
    )
  }

  return <KeywordText text={block.text} keywords={keywords} enabled={highlightKeywords} />
}

export default function DocumentReader({
  document,
  open,
  activeCitation,
  keywords,
  highlightKeywords,
  onToggleKeywords,
  onClose,
}: DocumentReaderProps) {
  const blockRefs = useRef(new Map<string, HTMLElement>())
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !activeCitation) return
    const frame = window.requestAnimationFrame(() => {
      const el = blockRefs.current.get(activeCitation.sourceId)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, activeCitation])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const copySection = (id: string, text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Document reader for ${document.fileName}`}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-emerald-900/20 bg-cream shadow-2xl dark:border-white/10 dark:bg-panel-dark sm:rounded-3xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-moss/15 px-5 py-3.5 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-moss-mist text-moss-deep dark:bg-white/10 dark:text-emerald-400">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-[15px] font-bold text-ink dark:text-text-dark">
                    {document.fileName}
                  </p>
                  {activeCitation ? (
                    <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Highlighted Evidence: {activeCitation.label}
                    </p>
                  ) : (
                    <p className="text-[11px] text-ink-soft dark:text-text-dark-soft">
                      {document.blocks.length} source section{document.blocks.length === 1 ? '' : 's'} · {document.fullText.length.toLocaleString()} characters
                    </p>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex shrink-0 items-center gap-2">
                {/* In-reader search input */}
                <div className="relative hidden sm:block">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft dark:text-text-dark-soft" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Find in document…"
                    className="h-8 w-40 rounded-xl border border-moss/20 bg-paper pl-7 pr-3 text-xs outline-none transition focus:w-56 focus:border-moss focus:ring-1 focus:ring-moss/20 dark:border-white/10 dark:bg-white/5 dark:text-text-dark"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink dark:text-text-dark-soft"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onToggleKeywords}
                  aria-pressed={highlightKeywords}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                    highlightKeywords
                      ? 'border-amber-500/50 bg-amber-100/60 text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200'
                      : 'border-moss/20 text-ink-soft dark:border-white/12 dark:text-text-dark-soft'
                  }`}
                >
                  <Highlighter size={13} />
                  <span>Keywords</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-ink-soft transition hover:bg-moss-mist hover:text-ink dark:text-text-dark-soft dark:hover:bg-white/5"
                  aria-label="Close reader"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable document content */}
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-8">
              {document.blocks.map(block => {
                const isSelected = activeCitation?.sourceId === block.id
                return (
                  <section
                    key={block.id}
                    ref={element => {
                      if (element) blockRefs.current.set(block.id, element)
                      else blockRefs.current.delete(block.id)
                    }}
                    data-source-id={block.id}
                    className={`group relative rounded-2xl border p-4 sm:p-5 transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/30 dark:border-emerald-400 dark:bg-emerald-950/20'
                        : 'border-moss/15 bg-paper/60 hover:border-moss/30 dark:border-white/8 dark:bg-white/[0.025]'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[10.5px] font-extrabold uppercase tracking-widest text-emerald-800 dark:text-emerald-400">
                        {block.label}
                      </span>
                      <button
                        onClick={() => copySection(block.id, block.text)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] text-ink-soft hover:bg-moss-mist dark:hover:bg-white/10"
                        title="Copy section text"
                      >
                        {copiedId === block.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                        <span>{copiedId === block.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <div className="whitespace-pre-wrap font-body text-[14.5px] leading-[1.8] text-ink dark:text-text-dark/95">
                      <SourceText
                        block={block}
                        citation={isSelected ? activeCitation : null}
                        keywords={keywords}
                        highlightKeywords={highlightKeywords}
                        searchTerm={searchTerm}
                      />
                    </div>
                  </section>
                )
              })}
            </div>

            {/* Footer with reader statistics */}
            <div className="flex items-center justify-between border-t border-moss/15 px-6 py-2.5 text-[11px] font-semibold text-ink-soft dark:border-white/10 dark:text-text-dark-soft">
              <span>{document.blocks.length} sections displayed</span>
              <span>Use <kbd className="rounded border px-1 font-mono text-[10px]">Esc</kbd> to exit reader</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
