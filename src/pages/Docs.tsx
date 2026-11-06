import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, KeyRound, UploadCloud, Sparkles, Boxes, CircleCheck } from 'lucide-react'
import MarketingNav from '../components/MarketingNav'

export default function Docs() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-paper-grain font-sans text-ink dark:bg-moss-night-deep dark:text-text-dark">
      <MarketingNav />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft transition hover:text-moss-deep dark:text-text-dark-soft dark:hover:text-text-dark"><ArrowLeft size={16} /> Back</button>

        <p className="mt-8 font-sans text-xs font-extrabold uppercase tracking-[0.2em] text-persimmon dark:text-persimmon-dark">Documentation</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">DocLense, <span className="font-serif italic text-moss dark:text-gold-dark">enterprise document intelligence.</span></h1>
        <p className="mt-4 max-w-2xl font-body text-lg leading-relaxed text-ink-soft dark:text-text-dark-soft">DocLense is an evidence-grounded document intelligence platform. Every summary, finding, and answer is linked to exact page and paragraph sources with interactive verification.</p>

        <section className="mt-10 rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark sm:p-8">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><Sparkles size={22} className="text-persimmon dark:text-persimmon-dark" />What DocLense provides</h2>
          <p className="mt-3 font-body leading-relaxed text-ink-soft dark:text-text-dark-soft">Drop single or multiple PDFs, text, or Markdown files into DocLense to receive:</p>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {[
              'Verifiable summaries with exact page/paragraph source links',
              'Key takeaways with clickable evidence chips',
              'Multi-document comparison and cross-document Q&A',
              'Full-text reader with in-document search and citation highlighting',
              'Complete 100% full-coverage mode or fast sampled mode',
              'Bounded Vision OCR for scanned PDFs without extractable text',
              'BM25 lexical retrieval for evidence-grounded chat answers',
              'Sentiment polarity (−100…+100) and confidence metrics',
              'Comprehension quiz with configurable difficulty',
              'Professional exports: Plain Text (.txt), Markdown (.md), and Print/PDF',
            ].map(x => (
              <li key={x} className="flex items-start gap-2 font-body text-[15px] text-ink dark:text-text-dark"><CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />{x}</li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark sm:p-8">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><Boxes size={22} className="text-persimmon dark:text-persimmon-dark" />Architecture &amp; Pipeline</h2>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-moss-night-deep p-5 font-mono text-[12.5px] leading-6 text-[#9fe8cd] dark:bg-black/40">{`┌─────────────────┐   drag & drop    ┌───────────────────────────┐
│ PDF / TXT / MD  │ ───────────────▶ │ pdf.js / plain-text parse │
└─────────────────┘                  └─────────────┬─────────────┘
                                                   │ source blocks (p1, p2, ...)
                                                   ▼
                                     ┌───────────────────────────┐
                                     │  Document Chunker & BM25  │ 12k target / 600 overlap
                                     │  Index & Citation Verifier│
                                     └─────────────┬─────────────┘
                                                   │ bounded map-reduce / direct
                                                   ▼
                               ┌──────────────────────────────────────┐
                               │  Groq Inference (BYOK Ephemeral)     │ api.groq.com
                               │  llama-3.3-70b · Zod Schema Validated │ strictly untrusted data
                               └──────────────────────────────────────┘`}</pre>
          <p className="mt-4 font-body text-[15px] text-ink-soft dark:text-text-dark-soft">Zero server. Zero database. Documents are processed locally in your tab using Web Workers, while analysis requests go directly to Groq over HTTPS with client-side citation verification.</p>
        </section>

        <section className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark">
            <h2 className="flex items-center gap-2.5 font-display text-xl font-bold"><KeyRound size={20} className="text-persimmon dark:text-persimmon-dark" />Get a Groq API key</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 font-body text-[15px] leading-relaxed text-ink-soft dark:text-text-dark-soft">
              <li>Visit <a className="font-semibold text-moss underline decoration-gold underline-offset-2 hover:text-moss-deep dark:text-gold-dark" href="https://console.groq.com" target="_blank" rel="noreferrer">console.groq.com</a> and sign up (it’s free).</li>
              <li>Open <b>API Keys</b> → <b>Create API Key</b>.</li>
              <li>Paste it into the Studio sidebar when you are ready to analyze a document.</li>
            </ol>
            <p className="mt-3 rounded-xl border border-gold/40 bg-[#fdf6dd] px-3 py-2 text-xs font-semibold text-[#7a5410] dark:border-gold-dark/25 dark:bg-gold-dark/10 dark:text-gold-dark">Ephemeral: Your key stays in this tab's memory and is sent only to api.groq.com. Reloading or closing the tab clears it completely.</p>
          </div>
          <div className="rounded-3xl border border-moss/20 bg-cream p-6 dark:border-white/10 dark:bg-panel-dark">
            <h2 className="flex items-center gap-2.5 font-display text-xl font-bold"><UploadCloud size={20} className="text-persimmon dark:text-persimmon-dark" />Usage &amp; Exports</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 font-body text-[15px] leading-relaxed text-ink-soft dark:text-text-dark-soft">
              <li>Drop a <b>.pdf</b> or <b>.txt/.md</b> file onto the dropzone (or load sample files).</li>
              <li>Select your preferred coverage: <b>Fast Sampled</b> or <b>Complete 100%</b>.</li>
              <li>Click any citation chip to jump directly to highlighted evidence in the document reader.</li>
              <li>Export reports as <b>Plain Text (.txt)</b>, <b>Markdown (.md)</b>, or <b>Print / PDF</b>.</li>
            </ol>
          </div>
        </section>

        <div className="mt-12 text-center">
          <Link to="/app" className="inline-flex items-center gap-2 rounded-2xl bg-emerald-800 px-6 py-4 font-sans text-base font-extrabold text-cream shadow-[0_4px_0_#064e3b] transition hover:bg-emerald-900 active:translate-y-0.5 active:shadow-[0_2px_0_#064e3b] dark:bg-emerald-600 dark:text-emerald-950 dark:shadow-[0_4px_0_#065f46]">
            Open Analysis Studio <ArrowRight size={18} />
          </Link>
        </div>
      </main>
    </div>
  )
}
