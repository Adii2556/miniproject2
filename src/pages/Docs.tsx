import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, KeyRound, UploadCloud, Sparkles, Terminal, Boxes, Cpu, CircleCheck } from 'lucide-react'
import MarketingNav from '../components/MarketingNav'
import DocLenseLogo from '../components/DocLenseLogo'

export default function Docs() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-paper-grain font-sans text-ink dark:bg-moss-night-deep dark:text-text-dark">
      <MarketingNav />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft transition hover:text-moss-deep dark:text-text-dark-soft dark:hover:text-text-dark"><ArrowLeft size={16} /> Back</button>

        <p className="mt-8 font-sans text-xs font-extrabold uppercase tracking-[0.2em] text-persimmon dark:text-persimmon-dark">Documentation</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">DocLense, <span className="font-serif italic text-moss dark:text-gold-dark">evidence in view.</span></h1>
        <p className="mt-4 max-w-2xl font-body text-lg leading-relaxed text-ink-soft dark:text-text-dark-soft">A client-side document intelligence workspace with explicit coverage, source navigation, cross-document retrieval, and bounded AI requests.</p>

        <section className="mt-10 rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark sm:p-8">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><Sparkles size={22} className="text-persimmon dark:text-persimmon-dark" />What DocLense does</h2>
          <p className="mt-3 font-body leading-relaxed text-ink-soft dark:text-text-dark-soft">Add up to six PDF or plain-text files and choose only the outputs you need:</p>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {['Exact source citations with local quote matching', 'Complete or sampled analysis with coverage disclosure', 'Cross-document Q&A with source identity', 'BM25-style lexical passage retrieval', 'Optional local English OCR for up to 10 scanned pages', 'Evidence-grounded quiz with difficulty and explanations', 'Word, character, sentence & reading-time stats', 'Cited TXT, Markdown, and PDF reports'].map(x => (
              <li key={x} className="flex items-start gap-2 font-body text-[15px] text-ink dark:text-text-dark"><CircleCheck size={16} className="mt-0.5 shrink-0 text-moss dark:text-persimmon-dark" />{x}</li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark sm:p-8">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><Boxes size={22} className="text-persimmon dark:text-persimmon-dark" />Architecture</h2>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-moss-night-deep p-5 font-mono text-[12.5px] leading-6 text-[#9fe8cd] dark:bg-black/40">{`PDF / TXT ─▶ local extraction / optional OCR
                    │
                    ▼
          source blocks + overlap chunks
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
 coverage & citations      lexical retrieval
          │                    │
          └─────────┬──────────┘
                    ▼
        bounded Groq JSON requests
                    │
                    ▼
       schema + exact-evidence checks`}</pre>
          <p className="mt-4 font-body text-[15px] text-ink-soft dark:text-text-dark-soft">DocLense has no application server or database. Extraction, OCR, statistics, retrieval, citation matching, and tab history run locally. Analysis and Q&amp;A send bounded source context directly to Groq over HTTPS.</p>
        </section>

        <section className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark">
            <h2 className="flex items-center gap-2.5 font-display text-xl font-bold"><KeyRound size={20} className="text-persimmon dark:text-persimmon-dark" />Get a Groq API key</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 font-body text-[15px] leading-relaxed text-ink-soft dark:text-text-dark-soft">
              <li>Visit <a className="font-semibold text-moss underline decoration-gold underline-offset-2 hover:text-moss-deep dark:text-gold-dark" href="https://console.groq.com" target="_blank" rel="noreferrer">console.groq.com</a> and create or use an account.</li>
              <li>Open <b>API Keys</b> → <b>Create API Key</b>.</li>
              <li>Paste it into the Studio sidebar when you are ready to analyze a document.</li>
            </ol>
            <p className="mt-3 rounded-xl border border-gold/40 bg-[#fdf6dd] px-3 py-2 text-xs font-semibold text-[#7a5410] dark:border-gold-dark/25 dark:bg-gold-dark/10 dark:text-gold-dark">Your key stays in this tab's memory and is sent only to api.groq.com. Reloading or closing the tab clears it.</p>
          </div>
          <div className="rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark">
            <h2 className="flex items-center gap-2.5 font-display text-xl font-bold"><UploadCloud size={20} className="text-persimmon dark:text-persimmon-dark" />Use it</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 font-body text-[15px] leading-relaxed text-ink-soft dark:text-text-dark-soft">
              <li>Add one or more <b>.pdf</b>, <b>.txt</b>, or <b>.md</b> files.</li>
              <li>Choose complete or sampled coverage and set an explicit chunk budget.</li>
              <li>Select Summary, Key points, Keywords, Sentiment, and/or Quiz.</li>
              <li>Press <kbd className="rounded border border-ink/20 bg-paper-deep px-1.5 font-mono text-xs dark:border-white/20 dark:bg-white/10">G</kbd> or the Generate button.</li>
              <li>Inspect evidence, ask questions, and export TXT, Markdown, or PDF.</li>
            </ol>
            <Link to="/app" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-moss px-4 py-2.5 font-sans text-sm font-bold text-cream transition hover:bg-moss-deep dark:bg-persimmon-dark dark:text-[#2b1206]">Open the Studio <ArrowRight size={15} /></Link>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark sm:p-8">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><Cpu size={22} className="text-persimmon dark:text-persimmon-dark" />Models</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead><tr className="border-b-2 border-moss/25 text-xs uppercase tracking-wider text-ink-soft dark:text-text-dark-soft"><th className="py-2 pr-4">Model ID</th><th className="py-2 pr-4">Suggested use</th><th className="py-2">Note</th></tr></thead>
              <tbody className="font-mono text-[12.5px]">
                {[['llama-3.3-70b-versatile', 'Complex evidence synthesis (default)', 'Availability and limits are set by Groq'], ['llama-3.1-8b-instant', 'Short documents and faster iteration', 'Re-check difficult citations'], ['openai/gpt-oss-120b', 'Large open-weight analysis', 'Model behavior can vary'], ['openai/gpt-oss-20b', 'Compact open-weight analysis', 'Prefer for lower-cost drafts']].map(r => (
                  <tr key={r[0]} className="border-b border-moss/10 dark:border-white/5"><td className="py-2.5 pr-4 font-semibold text-moss-deep dark:text-gold-dark">{r[0]}</td><td className="py-2.5 pr-4 font-sans">{r[1]}</td><td className="py-2.5">{r[2]}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-soft dark:text-text-dark-soft"><Terminal size={14} className="mt-0.5 shrink-0" />Endpoint: <code className="rounded bg-moss-mist px-1.5 py-0.5 font-mono dark:bg-white/10">https://api.groq.com/openai/v1/chat/completions</code> — OpenAI-compatible, JSON mode enabled via <code className="rounded bg-moss-mist px-1.5 py-0.5 font-mono dark:bg-white/10">response_format: json_object</code>.</p>
        </section>

        <div className="mt-12 text-center">
          <DocLenseLogo size={44} className="mx-auto" />
          <p className="mt-3 font-serif text-lg italic text-ink-soft dark:text-text-dark-soft">Happy reading.</p>
        </div>
      </main>
    </div>
  )
}
