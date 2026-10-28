import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, KeyRound, UploadCloud, CheckSquare, Sparkles, Terminal, Boxes, Cpu, CircleCheck } from 'lucide-react'
import MarketingNav from '../components/MarketingNav'
import DocentLogo from '../components/DocentLogo'

export default function Docs() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-paper-grain font-sans text-ink dark:bg-moss-night-deep dark:text-text-dark">
      <MarketingNav />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft transition hover:text-moss-deep dark:text-text-dark-soft dark:hover:text-text-dark"><ArrowLeft size={16} /> Back</button>

        <p className="mt-8 font-sans text-xs font-extrabold uppercase tracking-[0.2em] text-persimmon dark:text-persimmon-dark">Documentation</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Docent, <span className="font-serif italic text-moss dark:text-gold-dark">from zero to insights.</span></h1>
        <p className="mt-4 max-w-2xl font-body text-lg leading-relaxed text-ink-soft dark:text-text-dark-soft">Docent is a document-intelligence studio. This page mirrors the original project README — what it does, how it’s wired, and how to run your own instance.</p>

        <section className="mt-10 rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark sm:p-8">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><Sparkles size={22} className="text-persimmon dark:text-persimmon-dark" />What Docent does</h2>
          <p className="mt-3 font-body leading-relaxed text-ink-soft dark:text-text-dark-soft">Hand Docent a PDF or plain-text file and it returns, in a warm chat-style layout:</p>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {['Suggested title & one-line thesis', 'Summary (concise, detailed, or bullets)', '5–7 key takeaways', '8–12 keywords, highlighted in the reader', 'Sentiment polarity (−100…+100) with tone tags', 'A 10-question multiple-choice quiz with instant scoring', 'Word, character, sentence & reading-time stats', 'Downloadable summary (.txt) of everything'].map(x => (
              <li key={x} className="flex items-start gap-2 font-body text-[15px] text-ink dark:text-text-dark"><CircleCheck size={16} className="mt-0.5 shrink-0 text-moss dark:text-persimmon-dark" />{x}</li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark sm:p-8">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><Boxes size={22} className="text-persimmon dark:text-persimmon-dark" />Architecture</h2>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-moss-night-deep p-5 font-mono text-[12.5px] leading-6 text-[#9fe8cd] dark:bg-black/40">{`┌─────────────┐   drag & drop    ┌──────────────┐
│  PDF / TXT  │ ───────────────▶ │  pdf.js      │  in-browser parse
└─────────────┘                  └──────┬───────┘
                                        ▼
                              ┌───────────────────┐
                              │  stats engine      │ words · chars · wpm
                              │  (pure TypeScript) │ sentences · paragraphs
                              └──────┬────────────┘
                                     ▼
                    ┌────────────────────────────────┐
                    │  Groq chat completions API      │  api.groq.com
                    │  llama-3.3-70b-versatile · JSON │  your key, your device
                    └────────────────────────────────┘`}</pre>
          <p className="mt-4 font-body text-[15px] text-ink-soft dark:text-text-dark-soft">No server. No database. PDFs are parsed by pdf.js in your tab; statistics are computed with plain TypeScript; analysis requests go directly from your browser to Groq over HTTPS.</p>
        </section>

        <section className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark">
            <h2 className="flex items-center gap-2.5 font-display text-xl font-bold"><KeyRound size={20} className="text-persimmon dark:text-persimmon-dark" />Get a Groq API key</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 font-body text-[15px] leading-relaxed text-ink-soft dark:text-text-dark-soft">
              <li>Visit <a className="font-semibold text-moss underline decoration-gold underline-offset-2 hover:text-moss-deep dark:text-gold-dark" href="https://console.groq.com" target="_blank" rel="noreferrer">console.groq.com</a> and sign up (it’s free).</li>
              <li>Open <b>API Keys</b> → <b>Create API Key</b>.</li>
              <li>Paste it into the sidebar of the Studio, or put it in a <code className="rounded bg-moss-mist px-1.5 py-0.5 font-mono text-xs dark:bg-white/10">.env</code> file as <code className="rounded bg-moss-mist px-1.5 py-0.5 font-mono text-xs dark:bg-white/10">VITE_GROQ_API_KEY=gsk_…</code></li>
            </ol>
            <p className="mt-3 rounded-xl border border-gold/40 bg-[#fdf6dd] px-3 py-2 text-xs font-semibold text-[#7a5410] dark:border-gold-dark/25 dark:bg-gold-dark/10 dark:text-gold-dark">The key is stored in your browser’s localStorage only. It is never uploaded anywhere except directly to api.groq.com.</p>
          </div>
          <div className="rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark">
            <h2 className="flex items-center gap-2.5 font-display text-xl font-bold"><UploadCloud size={20} className="text-persimmon dark:text-persimmon-dark" />Use it</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 font-body text-[15px] leading-relaxed text-ink-soft dark:text-text-dark-soft">
              <li>Drop a <b>.pdf</b> or <b>.txt/.md</b> file onto the dropzone (or load a sample).</li>
              <li>Tick the analyses you want — Summary, Key points, Keywords, Sentiment, Quiz.</li>
              <li>Press <kbd className="rounded border border-ink/20 bg-paper-deep px-1.5 font-mono text-xs dark:border-white/20 dark:bg-white/10">G</kbd> or the Generate button.</li>
              <li>Answer the quiz for instant scoring, then download your summary as a <b>.txt</b>.</li>
            </ol>
            <Link to="/app" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-moss px-4 py-2.5 font-sans text-sm font-bold text-cream transition hover:bg-moss-deep dark:bg-persimmon-dark dark:text-[#2b1206]">Open the Studio <ArrowRight size={15} /></Link>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark sm:p-8">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><Cpu size={22} className="text-persimmon dark:text-persimmon-dark" />Models</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead><tr className="border-b-2 border-moss/25 text-xs uppercase tracking-wider text-ink-soft dark:text-text-dark-soft"><th className="py-2 pr-4">Model ID</th><th className="py-2 pr-4">Best for</th><th className="py-2">Speed</th></tr></thead>
              <tbody className="font-mono text-[12.5px]">
                {[['llama-3.3-70b-versatile', 'Highest-quality analysis (default)', '~280 tok/s'], ['llama-3.1-8b-instant', 'Instant iteration, high volume', '~560 tok/s'], ['openai/gpt-oss-120b', 'Flagship open-weight reasoning', '~500 tok/s'], ['openai/gpt-oss-20b', 'Maximum throughput drafts', '~1000 tok/s']].map(r => (
                  <tr key={r[0]} className="border-b border-moss/10 dark:border-white/5"><td className="py-2.5 pr-4 font-semibold text-moss-deep dark:text-gold-dark">{r[0]}</td><td className="py-2.5 pr-4 font-sans">{r[1]}</td><td className="py-2.5">{r[2]}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-soft dark:text-text-dark-soft"><Terminal size={14} className="mt-0.5 shrink-0" />Endpoint: <code className="rounded bg-moss-mist px-1.5 py-0.5 font-mono dark:bg-white/10">https://api.groq.com/openai/v1/chat/completions</code> — OpenAI-compatible, JSON mode enabled via <code className="rounded bg-moss-mist px-1.5 py-0.5 font-mono dark:bg-white/10">response_format: json_object</code>.</p>
        </section>

        <div className="mt-12 text-center">
          <DocentLogo size={44} className="mx-auto" />
          <p className="mt-3 font-serif text-lg italic text-ink-soft dark:text-text-dark-soft">Happy reading.</p>
        </div>
      </main>
    </div>
  )
}
