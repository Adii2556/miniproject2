import { BookOpenText, CircleCheck, CircleHelp } from 'lucide-react'
import type { Citation } from '../lib/document'

interface CitationChipsProps {
  citations: Citation[]
  onOpen: (citation: Citation) => void
  className?: string
}

export default function CitationChips({ citations, onOpen, className = '' }: CitationChipsProps) {
  if (citations.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Supporting evidence">
      {citations.map((citation, index) => {
        const verified = citation.status === 'verified'
        return (
          <button
            key={`${citation.sourceId}-${index}`}
            type="button"
            onClick={() => onOpen(citation)}
            title={`${citation.excerpt}\nEvidence support: ${Math.round(citation.supportScore * 100)}%`}
            aria-label={`Open ${verified ? 'verified' : 'uncertain'} evidence from ${citation.label}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold transition active:scale-[0.98] ${verified
              ? 'border-moss/30 bg-moss-mist/70 text-moss-deep hover:border-moss dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300'
              : 'border-gold/45 bg-gold/10 text-[#73500f] hover:border-gold dark:border-gold-dark/30 dark:bg-gold-dark/10 dark:text-gold-dark'}`}
          >
            <BookOpenText size={11} aria-hidden />
            <span className="max-w-[16rem] truncate">{citation.label}</span>
            {verified ? <CircleCheck size={11} aria-hidden /> : <CircleHelp size={11} aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}
