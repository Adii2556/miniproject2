# DocLense · Evidence-first document intelligence

DocLense is a browser-based workspace for analyzing up to six PDF or text documents with source-linked summaries, cross-document questions, evidence-grounded quizzes, and exportable reports. PDF extraction, statistics, retrieval, citation checks, and optional OCR run locally. Only a bounded document context is sent to Groq after the user starts analysis or asks a question.

## What is implemented

- Page/paragraph source models, overlapping chunks, exact-quote citation checks, and claim-support confidence labels.
- Complete mode with a hard request/chunk budget, plus an explicitly disclosed sampled mode with a coverage percentage.
- BM25-style lexical retrieval over the full workspace for cross-document Q&A.
- Up to six documents per workspace with source-distinct citations and reader navigation.
- Opt-in English OCR for image-only PDFs, locally executed and bounded to 10 pages and 2.5 million pixels per page.
- Zod-validated AI responses, one bounded repair attempt, timeouts, cancellation, and rate-limit-friendly concurrency.
- Quiz difficulty controls, cited explanations, reliable local scoring, and TXT, Markdown, or PDF report exports.
- Memory-only API keys, documents, analyses, and chat; no DocLense backend or database.

See [Architecture](docs/architecture.md), [Comparison and implementation plan](docs/comparison-and-plan.md), [Security findings](docs/security-findings.md), and [Benchmark protocol](docs/benchmark.md).

## Run locally

```bash
npm ci
npm run dev
```

Open the Studio, paste a personal Groq API key, and upload PDF, TXT, Markdown, or text files. Never put a shared secret in a `VITE_*` variable: Vite exposes those values in browser assets.

## Verification

```bash
npm run check
npm run audit:prod
npm run test:e2e
```

The browser suite runs desktop and mobile projects. `npm run test:headers` checks an actual deployment only when `DEPLOYMENT_URL` is set.

## Operational limits

- 15 MB per file; up to six documents per workspace.
- PDF extraction is bounded by page, character, canvas-pixel, and time limits.
- Complete mode refuses work that exceeds its configured budget instead of silently dropping sections.
- OCR is English-only, may be inaccurate, and processes at most the first 10 pages.
- Exact quotation can be verified mechanically; whether evidence truly entails a claim is estimated lexically and marked verified or uncertain. Important decisions still require human source review.
- Groq receives the selected document context, question/instructions, and the user's API key in the request authorization header. Groq's availability, retention, rate limits, and model behavior are outside this repository's control.

## Stack

React 19, strict TypeScript, Vite 7, Tailwind CSS 4, pdf.js, Tesseract.js, Zod, jsPDF, Vitest, and Playwright.
