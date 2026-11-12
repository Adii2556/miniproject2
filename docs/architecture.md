# Architecture

## Data flow

1. `AppShell` validates each file and dynamically loads PDF or OCR code only when needed.
2. `pdfExtract` emits page text; text files become paragraph blocks. `document` owns source IDs, overlap chunking, coverage, retrieval, and evidence verification.
3. `aiProviders` discovers provider models and routes chat requests through the same-origin allowlisted proxy. `groq` (the retained evidence engine module) selects complete or evenly distributed sampled chunks, maps large contexts with bounded concurrency, validates every response with Zod, and synthesizes cited output.
4. The reader resolves citation IDs back to exact source blocks and highlights the quoted range. Reports reuse the same validated citation objects.

No backend or persistent database exists.

```text
Files → validation → local extraction/OCR → source blocks → overlapping chunks
                                                     ├→ local stats/retrieval
                                                     └→ bounded selected-provider context
Provider JSON → schema validation → exact quote + support checks → UI/reader/exports
```

## Module boundaries

- `src/lib/fileSecurity.ts`, `pdfExtract.ts`, `ocr.ts`: untrusted-file/resource boundaries.
- `src/lib/document.ts`: canonical source, chunk, coverage, retrieval, and citation types.
- `src/lib/aiProviders.ts`: provider catalog normalization, compatibility, queueing, pacing, retries, and fallback.
- `server/aiProxy.ts`, `api/ai.ts`: fixed provider endpoint allowlist and transient credential forwarding for Vercel/local development.
- `src/lib/groq.ts`: provider-neutral AI prompts, evidence orchestration, timeout/cancel, schemas, and bounded in-memory digest reuse (the filename remains for compatibility).
- `src/lib/analysis.ts`: deterministic report rendering and lazy PDF generation.
- `src/components/DocumentReader.tsx`, `CitationChips.tsx`: evidence inspection.
- `src/pages/AppShell.tsx`: workflow state and integration, with no persistence of confidential content.

## Budgets and cancellation

- Direct analysis is used only when the entire workspace fits the direct character budget.
- Sampled mode selects a configurable number of chunks across all documents and reports analyzed/total coverage.
- Complete mode processes all chunks only within the explicit hard maximum; it otherwise returns a user-facing budget error.
- Map calls run with at most two concurrent requests. Each request has a 45-second timeout and one shared validation-repair budget. Upload, OCR, analysis, and Q&A have separate abort controllers.
- Provider requests share a two-request queue, apply token-aware start pacing, honor bounded `Retry-After`, retry temporary failures at most twice, and visit each consented fallback provider at most once.
- Successfully validated map digests are retained in a 40-entry memory-only cache keyed by exact chunk content. Re-running the same scope after an interruption reuses them; changed document content or selection produces different keys.

## Provider privacy boundary

- API keys live only in React memory and clear on reload. Only non-sensitive mode, priority, and model IDs persist locally; model catalogs use a 15-minute session cache.
- The browser calls only `/api/ai`. The proxy selects upstream URLs from a fixed provider allowlist, rejects oversized requests, disables caching, and never returns upstream bodies on errors.
- Automatic mode skips providers without an API key, model, explicit usage consent, or a model classified as incompatible.

## Evidence states

- **Verified:** the excerpt exists in the named source and lexical overlap indicates it plausibly supports the claim.
- **Uncertain:** the exact excerpt exists, but the automatic support check is weak.
- **Unavailable:** no valid source excerpt survived validation; Q&A refuses unsupported answers.

These states are not formal entailment proofs.

