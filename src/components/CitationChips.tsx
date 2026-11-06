import { BookOpenText } from 'lucide-react'
import type { Citation } from '../lib/document'

interface CitationChipsProps {
  citations: Citation[]
  onOpen: (citation: Citation) => void
  className?: string
}

export default function CitationChips({ citations, onOpen, className = '' }: CitationChipsProps) {
  if (!citations || citations.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Supporting evidence sources">
      {citations.map((citation, index) => {
        const docPrefix = citation.docName ? `${citation.docName}: ` : ''
        return (
          <button
            key={`${citation.sourceId}-${index}`}
            type="button"
            onClick={() => onOpen(citation)}
            title={`Excerpt: "${citation.excerpt}"`}
            aria-label={`Open supporting source ${docPrefix}${citation.label}`}
            className="group inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-50/70 px-2.5 py-1 text-[11px] font-bold text-emerald-800 transition hover:border-emerald-600 hover:bg-emerald-100/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:border-emerald-400 dark:hover:bg-emerald-900/60"
          >
            <BookOpenText size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" aria-hidden />
            <span className="truncate max-w-[180px]">{docPrefix}{citation.label}</span>
            {citation.verified && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Verified verbatim excerpt" />
            )}
          </button>
        )
      })}
    </div>
  )
}
