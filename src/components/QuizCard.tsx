import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileQuestion, Check, X, RotateCcw, Trophy, Lightbulb } from 'lucide-react'
import type { QuizQuestion } from '../lib/groq'

interface QuizCardProps {
  quiz: QuizQuestion[]
  onToast: (msg: string) => void
}

export default function QuizCard({ quiz, onToast }: QuizCardProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const total = quiz.length
  const answeredCount = Object.keys(answers).length
  const score = useMemo(() => quiz.reduce((acc, q, i) => (answers[i] === q.answer ? acc + 1 : acc), 0), [answers, quiz])
  const allDone = answeredCount === total && total > 0
  const pct = total ? Math.round((score / total) * 100) : 0

  const verdict = pct === 100 ? 'Perfect score — you could be this document’s author.' : pct >= 75 ? 'Excellent — the gist is yours.' : pct >= 50 ? 'Solid start — skim the summary once more.' : 'Worth another pass — the quiz is the fastest way to learn.'

  const pick = (qi: number, oi: number) => {
    if (answers[qi] !== undefined) return
    setAnswers(prev => ({ ...prev, [qi]: oi }))
    const q = quiz[qi]
    if (oi === q.answer) onToast('Correct!')
  }

  const retake = () => setAnswers({})

  return (
    <motion.article initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.45, ease: [0.22, 1, 0.36, 1] }} className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-moss text-cream shadow-[0_2px_0_#0e4740] dark:bg-persimmon-dark dark:text-[#2b1206] dark:shadow-[0_2px_0_#b4532a]">
        <svg width="19" height="19" viewBox="0 0 48 48" fill="none" aria-hidden>
          <path d="M8 13c9.4-3 17.6-1.6 24 3.5-8.5 3-16 6.6-24 3.5z" fill="currentColor" opacity="0.95" />
          <path d="M8 27c9.4-3 17.6-1.6 24 3.5-8.5 3-16 6.6-24 3.5z" fill="currentColor" opacity="0.7" />
          <circle cx="39" cy="10" r="3.4" fill="currentColor" />
        </svg>
      </div>

      <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg border border-moss/20 bg-cream p-5 shadow-sm dark:border-white/10 dark:bg-panel-dark">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#fbe3ef] text-[#b0306f] dark:bg-[#ff8ac2]/15 dark:text-[#ff9dcb]"><FileQuestion size={13} strokeWidth={2.4} /></span>
            <p className="font-sans text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-ink-soft dark:text-text-dark-soft">Quiz · test yourself</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1" aria-hidden>
              {quiz.map((_, i) => <span key={i} className={`h-1.5 w-5 rounded-full transition-colors ${answers[i] === undefined ? 'bg-moss/15 dark:bg-white/10' : answers[i] === quiz[i].answer ? 'bg-moss dark:bg-emerald-400' : 'bg-persimmon dark:bg-persimmon-dark'}`} />)}
            </div>
            <span className="font-mono text-[11px] font-bold text-ink-soft dark:text-text-dark-soft">{answeredCount}/{total}</span>
          </div>
        </div>

        {/* questions */}
        <ol className="mt-4 space-y-5">
          {quiz.map((q, qi) => {
            const chosen = answers[qi]
            const locked = chosen !== undefined
            return (
              <li key={qi}>
                <p className="font-body text-[15px] font-semibold leading-snug text-ink dark:text-text-dark"><span className="mr-1.5 font-mono text-xs font-bold text-persimmon dark:text-persimmon-dark">Q{qi + 1}.</span>{q.question}</p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {q.options.map((option, oi) => {
                    const isAnswer = oi === q.answer
                    const isChosen = chosen === oi
                    let cls = 'border-moss/20 bg-paper hover:border-moss/50 hover:bg-moss-mist/50 text-ink dark:border-white/12 dark:bg-white/[0.04] dark:text-text-dark dark:hover:border-persimmon-dark/40'
                    let badge = String.fromCharCode(65 + oi)
                    if (locked) {
                      if (isAnswer) cls = 'border-moss bg-moss-mist text-moss-deep dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-300'
                      else if (isChosen) cls = 'border-persimmon bg-persimmon-mist text-persimmon dark:border-persimmon-dark/60 dark:bg-persimmon-dark/10 dark:text-persimmon-dark'
                      else cls = 'border-moss/15 bg-paper text-ink-soft/80 dark:border-white/8 dark:bg-white/[0.02] dark:text-text-dark-soft/70'
                    }
                    return (
                      <button
                        key={oi}
                        onClick={() => pick(qi, oi)}
                        disabled={locked}
                        aria-pressed={isChosen}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold leading-snug transition ${locked ? 'cursor-default' : 'active:scale-[0.98]'} ${cls}`}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current/30 font-mono text-[10px] font-bold opacity-80">
                          {locked && isAnswer ? <Check size={13} strokeWidth={3} /> : locked && isChosen ? <X size={13} strokeWidth={3} /> : badge}
                        </span>
                        <span className="min-w-0">{option}</span>
                      </button>
                    )
                  })}
                </div>
                <AnimatePresence>
                  {locked && q.explanation && (
                    <motion.p initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: 8 }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-1.5 overflow-hidden font-body text-[13px] italic leading-snug text-ink-soft dark:text-text-dark-soft">
                      <Lightbulb size={13} className="mt-0.5 shrink-0 text-gold" />{q.explanation}
                    </motion.p>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ol>

        {/* score banner */}
        <AnimatePresence>
          {allDone && (
            <motion.div initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="mt-5 overflow-hidden rounded-2xl border border-gold/50 bg-gradient-to-br from-[#fdf3d0] to-[#fbe8b8] p-4 dark:border-gold-dark/30 dark:from-gold-dark/15 dark:to-gold-dark/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-[#5b3a05] shadow-inner"><Trophy size={24} strokeWidth={2.2} /></div>
                  <div>
                    <p className="font-display text-xl font-extrabold leading-none text-[#5b3a05] dark:text-gold-dark">{score}/{total} correct · {pct}%</p>
                    <p className="mt-1 font-body text-[12.5px] italic text-[#6e4e10] dark:text-gold-dark/80">{verdict}</p>
                  </div>
                </div>
                <button onClick={retake} className="inline-flex items-center gap-1.5 rounded-xl border border-[#5b3a05]/25 px-3.5 py-2 font-sans text-xs font-extrabold uppercase tracking-wide text-[#5b3a05] transition hover:bg-[#5b3a05] hover:text-cream dark:border-gold-dark/40 dark:text-gold-dark dark:hover:bg-gold-dark dark:hover:text-[#2b1206]">
                  <RotateCcw size={13} strokeWidth={2.5} /> Retake
                </button>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#5b3a05]/15 dark:bg-black/30">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-gold to-persimmon" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  )
}
