# Source comparison and implemented plan

## Method

The latest fetched `main` sources were compared file-by-file. MiniProject1 was kept read-only. Claims below are based on code and tests, not repository marketing text. MiniProject2's pre-change checks passed (11 unit tests, lint, TypeScript production build, and production dependency audit).

## Before implementation

| Area | MiniProject1 source | DocLense baseline | Decision |
|---|---|---|---|
| Citations | Source blocks, cited summaries/key points/Q&A, reader navigation | No source-linked generated output | Bring over the sound concept and strengthen support classification. |
| Long documents | Overlapping chunks and map/reduce, but at most six evenly sampled chunks | First 24,000 characters only | Replace both with explicit complete/sampled budgets and honest coverage. |
| Retrieval | Simple term occurrence scoring with one adjacent chunk | Q&A reused the truncated prefix | Add full-workspace BM25-style lexical ranking without external infrastructure. |
| AI validation | Zod schemas and one repair attempt | JSON parsing with looser structural checks | Use strict bounded schemas, timeout/cancel, and one repair attempt. |
| Reader | Highlighted evidence and keyword navigation | Plain extracted-text preview | Add source/document navigation and verified/uncertain evidence state. |
| Export | TXT with citations | TXT without verifiable citations | Add evidence-indexed TXT, Markdown, and lazy-loaded PDF. |
| Quiz | Local scoring and explanations, but no quiz citations | Local scoring and explanations | Add difficulty and cited questions/explanations. |
| Multiple documents | Single document | Single document | Add six-document workspace and source-distinct cross-document Q&A. |
| OCR | Not implemented | Not implemented | Add opt-in, self-hosted, bounded local OCR with limitations. |
| Security strengths | Prompt boundaries, schemas, source validation | Stronger abort-aware parsing, key/history kept in memory, restrictive headers | Preserve DocLense strengths and combine them with evidence validation. |
| Branding/copy | Mixed Docent/DocLense and several unverified promises | DocLense visual identity with some unverified marketing copy | Preserve DocLense and replace unsupported metrics/claims. |

## Prioritized gap plan and status

1. **P0 correctness:** source model, chunking, citation validation, full-document retrieval, coverage disclosure — implemented and unit tested.
2. **P0 security:** memory-only secrets, bounded files/requests/OCR, prompt-injection boundary, error redaction, CSP/supply-chain checks — implemented; deployment header verification remains environment-dependent.
3. **P1 product:** multi-document workspace, complete/sampled modes, cited Q&A/quiz, evidence reader, cancellation/progress — implemented and browser-tested with mocked Groq.
4. **P1 exports/accessibility:** TXT/Markdown/PDF reports, keyboard/focus semantics, responsive desktop/mobile flows — implemented; automated accessibility checks cover the primary route.
5. **P2 validation:** CI, unit/integration/security/browser suites, benchmark protocol — implemented. Live model quality comparison requires a user-supplied key and controlled fixture documents, so no accuracy score is asserted.

## Preserved DocLense advantages

- DocLense name, visual palette, typography, themes, sample documents, configurable sections/models, local statistics, history-in-memory behavior, and abort-aware local PDF extraction.
- No server/database requirement and no shared API secret in browser bundles.
- Existing upload, analysis, Q&A, quiz, and theme flows remain in the integrated application rather than being replaced by disconnected demos.

## Known trade-offs

- Complete client-side analysis can make many Groq calls; budgets are intentionally finite and the UI refuses over-budget work.
- Lexical retrieval is predictable and infrastructure-free but weaker than embeddings for paraphrases. Semantic infrastructure should only be added after a measured corpus demonstrates the need.
- Multi-document history stores only the most recently active document snapshot; it is not a durable workspace store.

