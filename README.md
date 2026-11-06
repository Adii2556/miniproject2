# DocLense · Enterprise Document Intelligence Platform

> Advanced, evidence-grounded document intelligence platform powered by Groq LPUs. Drop in single or multiple PDFs, text, or Markdown files and receive instant verifiable summaries, citation-backed takeaways, topical keywords, sentiment analysis, local document statistics, scored comprehension quizzes, and BM25-retrieved grounded Q&A.

---

## ✨ Features & Capabilities

### 1. Verifiable Citations & Source Evidence
- **Verbatim Excerpt Matching**: Summaries, key findings, and Q&A responses are verified against exact source blocks. Unsupported claims are caught and omitted.
- **Interactive Citation Chips**: Click any source citation (e.g. `[Page 2]` or `[Contract.pdf: Page 4]`) to open the built-in reader and smoothly scroll directly to the highlighted evidence.

### 2. Multi-Document Intelligence
- **Multi-File Workspace**: Upload multiple documents into a single active session with live tabs.
- **Cross-Document Q&A**: Ask questions that compare, contrast, and pull facts across multiple documents simultaneously, with clear citation provenance indicating which document and page supplied the evidence.

### 3. Configurable Document Coverage Modes
- **Complete Mode (100% Coverage)**: Synthesizes entire lengthy documents through parallel map-reduce batches with verified claim digestion.
- **Fast Sampled Mode**: Rapid evaluation sampling representative sections across beginning, middle, and end.
- **Coverage Transparency**: Real-time coverage badges disclose the exact percentage of text and chunks evaluated.

### 4. Scanned PDF Support & Bounded Vision OCR
- **Image PDF Detection**: Automatically identifies scanned PDFs with zero extractable text layer.
- **Bounded Vision OCR**: Transcribes scanned document pages into verified source blocks using Groq's Vision models with rate-limit bounding (up to 5 pages), memory protection, and transparent accuracy notes.

### 5. Intelligent BM25 Retrieval for Q&A
- **Lexical BM25 Ranking**: Uses term frequency, document frequency dampening, query term weighting, and phrase boosting rather than naive text truncation.
- **Adjacent Context Cohesion**: Automatically includes adjacent passages for continuous narrative flow and accurate context.

### 6. Full-Text Document Reader
- **In-Reader Search**: Live text search with match highlights.
- **Keyword & Citation Highlighting**: Toggleable gold keyword highlights and green verified evidence highlights.
- **One-Click Section Copy**: Effortlessly copy individual source paragraphs or pages.

### 7. Multi-Format Professional Exports
- **Plain Text (.txt)**: Clean structured analysis report with numeric `[1]` citation markers and reference tables.
- **Markdown (.md)**: Fully formatted Markdown with headers, blockquotes, metric tables, and academic footnotes.
- **Print / PDF**: Instant print preview with `@media print` styling for clean, professional PDF report generation.

---

## 🔒 Security Architecture

DocLense implements an exhaustive defense-in-depth model:
- **Bring-Your-Own-Key (BYOK) Ephemeral Memory**: Groq API keys reside strictly in memory for the active tab session. Keys are never written to `localStorage`, `sessionStorage`, cookies, or remote analytics.
- **Prompt Injection Boundaries**: Source document content is strictly marked as untrusted quoted data with JSON demarcation and system override defenses.
- **Strict Content Security Policy (CSP)**:
  - `script-src 'self'` (Zero `'unsafe-eval'`).
  - `object-src 'none'`.
  - `base-uri 'none'`.
  - `frame-ancestors 'none'`.
  - `connect-src 'self' https://api.groq.com`.
- **Zero-Trust File Ingestion**: Magic byte signature verification (`%PDF-`), page bounding (max 250 pages), character limits, ReDoS-safe linear text processing, and canvas dimension limits to prevent memory exhaustion attacks.
- **Path Traversal Defenses**: `sanitizeFileName()` strips traversal sequences (`../`, `..\`) and reserved characters.
- **Opener & Framer Isolation**: COOP (`same-origin`), CORP (`same-origin`), X-Frame-Options (`DENY`), and HSTS (`max-age=31536000`).

---

## 🛠️ Tech Stack

- **Framework**: React 19, TypeScript (Strict Mode)
- **Bundler & Code Splitting**: Vite 7 with modular vendor chunks (`vendor-react`, `vendor-motion`, `vendor-pdf`, `vendor-zod`)
- **Validation**: Zod 4 for runtime schema enforcement and bounded retry correction
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **PDF Engine**: `pdfjs-dist` (Legacy Worker for universal browser/Node compatibility)
- **Icons & Animation**: `lucide-react`, `framer-motion`
- **Testing**: Vitest, Node test runner, automated security audit suite

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/Adii2556/miniproject2.git
cd miniproject2
npm install
```

### 2. Run Quality Gate (Lint, Tests, Build, Security Scan)
```bash
npm run check
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## 🧪 Testing & Verification

DocLense includes an automated test suite verifying security, pipeline accuracy, and error resilience:
```bash
# Run unit and security audit tests
npm test

# Run secret scanning regression check
npm run check:security

# Run comparative benchmark
node scripts/benchmark-comparison.mjs
```
