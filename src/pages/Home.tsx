import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, UploadCloud, Sparkles, ListChecks, Tags, Gauge, FileQuestion, Download,
  FileText, ShieldCheck, Keyboard, Zap, Timer, BadgeCheck, Quote, Star, BookOpenCheck,
} from 'lucide-react'
import MarketingNav from '../components/MarketingNav'
import DocLenseLogo from '../components/DocLenseLogo'

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
}

export default function Home() {
  const location = useLocation() as { state?: { scrollTo?: string } }

  useEffect(() => {
    const target = location.state?.scrollTo
    if (target) {
      const el = document.getElementById(target)
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 60)
    }
  }, [location.state])

  return (
    <div className="min-h-screen bg-paper-grain font-sans text-ink dark:bg-moss-night-deep dark:text-text-dark">
      <MarketingNav />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <img src="/images/doclense-nook-dark.png" alt="" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 h-full w-full object-cover opacity-[0.16] dark:opacity-45 md:w-[62%]" style={{ maskImage: 'linear-gradient(to left, black 40%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to left, black 40%, transparent 100%)' }} />
        <div className="pointer-events-none absolute -left-40 top-24 h-96 w-96 rounded-full bg-moss-mist/70 blur-3xl dark:bg-moss/10" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-12 md:pb-24 md:pt-20">
          <div className="md:col-span-7">
            <motion.div {...fadeUp} transition={{ duration: 0.55 }} className="inline-flex items-center gap-2 rounded-full border border-moss/25 bg-cream px-3.5 py-1.5 shadow-sm dark:border-white/10 dark:bg-panel-dark">
              <span className="flex h-2 w-2"><span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-persimmon opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-persimmon" /></span>
              <span className="text-xs font-semibold tracking-wide text-moss-deep dark:text-text-dark-soft">Powered by Groq · llama-3.3-70b-versatile</span>
            </motion.div>

            <motion.h1 {...fadeUp} transition={{ duration: 0.6, delay: 0.08 }} className="mt-5 font-display text-[2.65rem] font-extrabold leading-[1.04] tracking-tight text-ink dark:text-text-dark sm:text-6xl xl:text-[4.3rem]">
              Upload a document.<br />
              Meet{' '}
              <span className="relative inline-block text-moss dark:text-persimmon-dark">
                DocLense.
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 220 14" fill="none" aria-hidden><path d="M4 10.5C60 4 150 3.5 216 9" stroke="#e8572a" strokeWidth="5.5" strokeLinecap="round" opacity="0.85"/></svg>
              </span>
            </motion.h1>

            <motion.p {...fadeUp} transition={{ duration: 0.6, delay: 0.16 }} className="mt-6 max-w-xl font-body text-lg leading-relaxed text-ink-soft dark:text-text-dark-soft sm:text-xl">
              Drop in a <span className="font-semibold text-ink dark:text-text-dark">PDF or TXT</span> and get a friendly, chat-style analysis — summary, key points, keywords, sentiment, a scored quiz, and hard document stats. In seconds.
            </motion.p>

            <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.24 }} className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/app" className="group inline-flex items-center gap-2 rounded-2xl bg-persimmon px-6 py-4 font-sans text-base font-bold text-cream shadow-[0_4px_0_#b93a17] transition hover:bg-persimmon-soft hover:shadow-[0_4px_0_#b93a17] active:translate-y-0.5 active:shadow-[0_2px_0_#b93a17] dark:bg-persimmon-dark dark:text-[#2b1206] dark:shadow-[0_4px_0_#b4532a]">
                <UploadCloud size={19} strokeWidth={2.4} />
                Analyze your document
                <ArrowRight size={18} strokeWidth={2.5} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <button onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-2xl border-2 border-moss/30 bg-transparent px-6 py-[14px] font-sans text-base font-bold text-moss-deep transition hover:border-moss hover:bg-moss-mist dark:border-white/15 dark:text-text-dark dark:hover:border-persimmon-dark/50 dark:hover:bg-white/5">
                See how it works
              </button>
            </motion.div>

            <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.32 }} className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-ink-soft dark:text-text-dark-soft">
              {['No account needed', 'Runs in your browser', 'Your key stays on your device'].map(t => (
                <span key={t} className="inline-flex items-center gap-1.5"><BadgeCheck size={14} className="text-moss dark:text-persimmon-dark" />{t}</span>
              ))}
            </motion.div>
          </div>

          {/* floating preview collage */}
          <div className="relative mx-auto hidden h-[430px] w-full max-w-md md:col-span-5 md:block" aria-hidden>
            <motion.img
              src="/images/doclense-hero.png"
              alt=""
              className="absolute right-2 top-2 w-64 drop-shadow-2xl lg:w-72"
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-0 top-6 w-56 rounded-2xl border border-moss/20 bg-cream/95 p-4 shadow-xl backdrop-blur dark:border-white/10 dark:bg-panel-dark/95"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-persimmon dark:text-persimmon-dark"><Sparkles size={11} /> Suggested title</div>
              <p className="mt-1.5 font-serif text-[13px] font-semibold leading-snug text-ink dark:text-text-dark">The Quiet Revolution of Urban Forests</p>
            </motion.div>
            <motion.div
              className="absolute bottom-24 left-6 w-52 rounded-2xl border border-moss/20 bg-cream/95 p-4 shadow-xl backdrop-blur dark:border-white/10 dark:bg-panel-dark/95"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
            >
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-moss-deep dark:text-gold-dark"><span>Sentiment</span><Gauge size={11} /></div>
              <div className="mt-2 flex items-end justify-between">
                <span className="font-display text-2xl font-extrabold text-moss dark:text-text-dark">+62</span>
                <span className="rounded-full bg-moss-mist px-2 py-0.5 text-[10px] font-bold text-moss-deep dark:bg-persimmon-dark/15 dark:text-persimmon-dark">Positive · hopeful</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-moss-mist dark:bg-white/10"><div className="h-full w-[81%] rounded-full bg-gradient-to-r from-persimmon to-gold" /></div>
            </motion.div>
            <motion.div
              className="absolute bottom-2 right-4 w-60 rounded-2xl border border-moss/20 bg-cream/95 p-4 shadow-xl backdrop-blur dark:border-white/10 dark:bg-panel-dark/95"
              animate={{ y: [0, 9, 0] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 1.6 }}
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-ink-soft dark:text-text-dark-soft"><Tags size={11} /> Keywords</div>
              <div className="mt-1.5 flex flex-wrap gap-1">{['urban forests', 'canopy', 'equity', '+58 more'].map(k => <span key={k} className="rounded-md bg-moss-mist px-1.5 py-0.5 text-[10px] font-semibold text-moss-deep dark:bg-white/10 dark:text-text-dark-soft">{k}</span>)}</div>
            </motion.div>
          </div>
        </div>

        {/* stat strip */}
        <div className="relative border-y border-moss/15 bg-moss-deep text-cream dark:border-white/10 dark:bg-panel-dark">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-4 py-3 text-center sm:justify-between sm:px-6">
            {[['~10×', 'faster than manual review'], ['4', 'models on tap'], ['6', 'insights in one pass'], ['100%', 'in-browser, private']].map(([n, d]) => (
              <div key={n} className="flex items-baseline gap-2"><span className="font-display text-xl font-extrabold text-gold-dark">{n}</span><span className="text-[11px] font-semibold uppercase tracking-wider text-cream/80">{d}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="relative mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 md:py-24">
        <div className="max-w-2xl">
          <p className="font-sans text-xs font-extrabold uppercase tracking-[0.2em] text-persimmon dark:text-persimmon-dark">Everything, one upload</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink dark:text-text-dark sm:text-5xl">Six superpowers, <span className="font-serif italic text-moss dark:text-gold-dark">zero busywork.</span></h2>
          <p className="mt-4 font-body text-lg text-ink-soft dark:text-text-dark-soft">Pick exactly what you want — summary, takeaways, quiz and more — with checkboxes after upload. DocLense only generates what you tick.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Sparkles, title: 'Summary & suggested title', body: 'A clean, readable brief plus a confident title the document might have deserved. Tune concision, reading level and language.', tint: 'bg-persimmon-mist text-persimmon dark:bg-persimmon-dark/15 dark:text-persimmon-dark' },
            { icon: ListChecks, title: 'Key points', body: 'Five to seven crisp takeaways you can paste into a standup or lecture — no digging for the signal.', tint: 'bg-moss-mist text-moss-deep dark:bg-moss/25 dark:text-[#7fd6c2]' },
            { icon: Tags, title: 'Keywords & topics', body: 'Frequency- and meaning-based keywords, highlighted right inside the full-text reader so context is one click away.', tint: 'bg-[#f4ead0] text-[#8a5b0e] dark:bg-gold-dark/15 dark:text-gold-dark' },
            { icon: Gauge, title: 'Sentiment, scored', body: 'A −100…+100 polarity gauge with confidence and tone adjectives — hopeful, skeptical, urgent, whatever is true.', tint: 'bg-[#e7e3f7] text-[#5246b0] dark:bg-[#8f83ff]/15 dark:text-[#b3a8ff]' },
            { icon: FileQuestion, title: 'A scored quiz', body: 'Ten grounded multiple-choice questions with instant scoring, explanations, and a shareable score card.', tint: 'bg-[#fbe3ef] text-[#b0306f] dark:bg-[#ff8ac2]/15 dark:text-[#ff9dcb]' },
            { icon: Timer, title: 'Real document stats', body: 'Words, characters, sentences, paragraphs, vocabulary diversity and reading time at 225 wpm — computed locally, instantly.', tint: 'bg-[#e0f0ea] text-[#146b4f] dark:bg-[#4be0a8]/10 dark:text-[#5fe0aa]' },
          ].map(({ icon: Icon, title, body, tint }) => (
            <div key={title} className="group rounded-3xl border border-moss/15 bg-cream p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-moss/30 hover:shadow-xl dark:border-white/10 dark:bg-panel-dark dark:hover:border-persimmon-dark/30">
              <div className={`inline-flex rounded-2xl p-3 ${tint} transition-transform duration-300 group-hover:scale-110`}><Icon size={22} strokeWidth={2.2} /></div>
              <h3 className="mt-4 font-display text-xl font-bold text-ink dark:text-text-dark">{title}</h3>
              <p className="mt-2 font-body text-[15px] leading-relaxed text-ink-soft dark:text-text-dark-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="dot-grid scroll-mt-24 border-y border-moss/15 bg-paper-deep/60 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
          <p className="font-sans text-xs font-extrabold uppercase tracking-[0.2em] text-persimmon dark:text-persimmon-dark">Three steps</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink dark:text-text-dark sm:text-5xl">From file to understanding<br />in <span className="font-serif italic text-moss dark:text-gold-dark">three breaths.</span></h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { n: '01', icon: UploadCloud, title: 'Drop it in', body: 'Drag a PDF or TXT onto the dropzone — or sample one of six built-in documents. Invalid or empty files get a friendly, specific error, never a stack trace.' },
              { n: '02', icon: ListChecks, title: 'Choose your dishes', body: 'After upload you tick exactly what you want: summary, key points, keywords, sentiment, quiz. Nothing is generated behind your back.' },
              { n: '03', icon: Zap, title: 'Read at the top', body: 'Results are pinned above the input — title first — so you never get yanked to the bottom of the page after generating. Copy, download, quiz yourself.' },
            ].map(({ n, icon: Icon, title, body }) => (
              <div key={n} className="relative overflow-hidden rounded-3xl border border-moss/20 bg-cream p-7 dark:border-white/10 dark:bg-panel-dark">
                <span className="pointer-events-none absolute -right-2 -top-4 font-display text-[88px] font-extrabold leading-none text-moss/10 dark:text-white/5">{n}</span>
                <Icon size={26} className="text-persimmon dark:text-persimmon-dark" strokeWidth={2.2} />
                <h3 className="mt-4 font-display text-2xl font-bold text-ink dark:text-text-dark">{title}</h3>
                <p className="mt-2 font-body leading-relaxed text-ink-soft dark:text-text-dark-soft">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRIVACY ============ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="overflow-hidden rounded-[2rem] border border-moss/25 bg-gradient-to-br from-moss-deep via-moss to-moss-deep p-8 text-cream shadow-2xl dark:border-persimmon-dark/20 dark:from-panel-dark dark:via-moss-night dark:to-panel-dark md:p-12">
          <div className="grid items-center gap-8 md:grid-cols-12">
            <div className="md:col-span-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-gold-dark"><ShieldCheck size={14} /> Privacy by architecture</div>
              <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight md:text-4xl">Your document never touches our servers —<br />because we don’t have any.</h2>
              <p className="mt-4 max-w-2xl font-body text-lg leading-relaxed text-cream/85">PDFs are parsed in your browser. Stats are computed locally. Your Groq API key is stored on your device only, and requests go straight from this tab to Groq’s API. There is no backend, no database, no logging of your content — just you and the model.</p>
            </div>
            <div className="md:col-span-4">
              <div className="rounded-2xl border border-white/15 bg-black/20 p-5 font-mono text-[12px] leading-6 text-gold-dark/95">
                <p className="text-cream/60"># the entire data flow</p>
                <p><span className="text-cream/80">you.pdf</span> → <span className="text-[#8fe3cf]">pdf.js</span></p>
                <p>localhost <span className="text-cream/60">{'→'}</span> api.groq.com</p>
                <p><span className="text-[#8fe3cf]">your key</span> <span className="text-cream/60">→ stays in localStorage</span></p>
                <p><span className="text-cream/80">no backend · no DB · no tracking</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIAL ============ */}
      <section className="mx-auto max-w-4xl px-4 pb-8 text-center sm:px-6">
        <Quote size={34} className="mx-auto text-persimmon/70 dark:text-persimmon-dark/70" fill="currentColor" />
        <p className="mt-5 font-serif text-2xl font-medium italic leading-snug text-ink dark:text-text-dark sm:text-3xl">“I fed DocLense a 60-page grant proposal on a Tuesday night. By Wednesday morning I had the argument, the risks, and the quiz I needed to brief my board — all before my coffee cooled.”</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-moss font-display text-sm font-bold text-cream dark:bg-persimmon-dark dark:text-[#2b1206]">MK</div>
          <div className="text-left"><p className="font-sans text-sm font-bold text-ink dark:text-text-dark">Maya Krishnamurthy</p><p className="text-xs text-ink-soft dark:text-text-dark-soft">Head of Programs · Lumen Foundation</p></div>
        </div>
        <div className="mt-5 flex items-center justify-center gap-1 text-gold">{[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}</div>
      </section>

      {/* ============ CTA ============ */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6">
        <div className="text-center">
          <BookOpenCheck size={40} className="mx-auto text-moss dark:text-persimmon-dark" strokeWidth={1.8} />
          <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink dark:text-text-dark sm:text-5xl">Your next document is<br />already understood.</h2>
          <Link to="/app" className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-persimmon px-8 py-4 font-sans text-lg font-bold text-cream shadow-[0_4px_0_#b93a17] transition hover:bg-persimmon-soft active:translate-y-0.5 dark:bg-persimmon-dark dark:text-[#2b1206] dark:shadow-[0_4px_0_#b4532a]">
            Open the Studio <ArrowRight size={20} strokeWidth={2.5} />
          </Link>
          <p className="mt-4 text-sm font-medium text-ink-soft dark:text-text-dark-soft"><Keyboard size={14} className="mr-1 inline" />Pro tip: press <kbd className="rounded-md border border-ink/20 bg-cream px-1.5 py-0.5 font-mono text-xs shadow-sm dark:border-white/20 dark:bg-panel-dark">G</kbd> on the analysis screen to generate, <kbd className="rounded-md border border-ink/20 bg-cream px-1.5 py-0.5 font-mono text-xs shadow-sm dark:border-white/20 dark:bg-panel-dark">D</kbd> to download.</p>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-moss/15 bg-paper-deep/70 dark:border-white/10 dark:bg-panel-dark">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 py-8 sm:px-6 md:flex-row">
          <div className="flex items-center gap-2.5"><DocLenseLogo size={30} /><span className="font-display font-bold text-ink dark:text-text-dark">DocLense</span><span className="text-xs text-ink-soft dark:text-text-dark-soft">— your patient reading companion</span></div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-ink-soft dark:text-text-dark-soft">
            <Link to="/app" className="hover:text-moss dark:hover:text-persimmon-dark">Studio</Link>
            <Link to="/docs" className="hover:text-moss dark:hover:text-persimmon-dark">Docs</Link>
            <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="hover:text-moss dark:hover:text-persimmon-dark">Get a Groq key</a>
          </nav>
          <p className="text-xs text-ink-soft/80 dark:text-text-dark-soft/70">© 2026 DocLense. Built with pdf.js, React and Groq.</p>
        </div>
      </footer>
    </div>
  )
}
