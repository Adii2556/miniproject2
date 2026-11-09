# Architecture

## Data flow

1. `AppShell` validates each file and dynamically loads PDF or OCR code only when needed.
2. `pdfExtract` emits page text; text files become paragraph blocks. `document` owns source IDs, overlap chunking, coverage, retrieval, and evidence verification.
3. `groq` selects complete or evenly distributed sampled chunks, maps large contexts with bounded concurrency, validates every response with Zod, and synthesizes cited output.
4. The reader resolves citation IDs back to exact source blocks and highlights the quoted range. Reports reuse the same validated citation objects.

No backend or persistent database exists.

```text
Files → validation → local extraction/OCR → source blocks → overlapping chunks
                                                     ├→ local stats/retrieval
                                                     └→ bounded Groq context
Groq JSON → schema validation → exact quote + support checks → UI/reader/exports
```

## Module boundaries

- `src/lib/fileSecurity.ts`, `pdfExtract.ts`, `ocr.ts`: untrusted-file/resource boundaries.
- `src/lib/document.ts`: canonical source, chunk, coverage, retrieval, and citation types.
- `src/lib/groq.ts`: AI prompts, orchestration, retry/timeout/cancel, and schemas.
- `src/lib/analysis.ts`: deterministic report rendering and lazy PDF generation.
- `src/components/DocumentReader.tsx`, `CitationChips.tsx`: evidence inspection.
- `src/pages/AppShell.tsx`: workflow state and integration, with no persistence of confidential content.

## Budgets and cancellation

- Direct analysis is used only when the entire workspace fits the direct character budget.
- Sampled mode selects a configurable number of chunks across all documents and reports analyzed/total coverage.
- Complete mode processes all chunks only within the explicit hard maximum; it otherwise returns a user-facing budget error.
- Map calls run with at most two concurrent requests. Each request has a 45-second timeout and one shared validation-repair budget. Upload, OCR, analysis, and Q&A have separate abort controllers.

## Evidence states

- **Verified:** the excerpt exists in the named source and lexical overlap indicates it plausibly supports the claim.
- **Uncertain:** the exact excerpt exists, but the automatic support check is weak.
- **Unavailable:** no valid source excerpt survived validation; Q&A refuses unsupported answers.

These states are not formal entailment proofs.

