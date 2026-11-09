# Final engineering report

Date: 9 November 2026

## Assessment

Against the inspected source baselines, DocLense now surpasses MiniProject1 in complete-document budgeting, multi-document work, retrieval ranking, evidence-status disclosure, OCR, export formats, cancellation/timeouts, and integrated security/testing. It retains the reference application's valuable citation-reader and schema-validation ideas while preserving DocLense's stronger abort-aware parsing and memory-only secret/history behavior.

This is not a claim of universal model superiority. Live factual accuracy, latency, token use, and cost were not scored because no credential and controlled fixture corpus were supplied. The fair protocol is in `docs/benchmark.md`.

## Before and after

| Capability | DocLense before | Delivered |
|---|---|---|
| Document coverage | First 24,000 characters silently used | Complete or sampled mode, explicit chunk/request budget, measured coverage, over-budget refusal |
| Evidence | Uncited generated content | Source IDs, exact quote lookup, support score, verified/uncertain UI, highlighted reader navigation |
| Q&A | Same truncated prefix | BM25-style retrieval across all chunks and documents; unsupported-answer refusal |
| Documents | One | Up to six, with distinct source labels and cross-document questions |
| Validation | Loose JSON handling | Bounded Zod schemas, one repair attempt, output normalization, exact evidence checks |
| PDF scans | No OCR | Opt-in local English OCR, self-hosted assets, 10-page/pixel/time bounds and progress/cancel |
| Reports | TXT | Citation-indexed TXT, Markdown, and formatted PDF |
| Quiz | Uncited adaptive questions | Difficulty setting, cited explanations, local scoring |
| Feedback | Coarse simulated steps | Map/synthesis progress, coverage, cancellation, actionable failures |
| Tests/CI | 11 unit tests | 28 unit/security tests, 8 passing primary browser cases across desktop/mobile, accessibility scan, deployment-header tests, pinned CI and Dependabot |

## Architecture and security

- Canonical document/source/chunk/citation types are separated from AI orchestration, extraction/OCR, UI, and report generation.
- Heavy PDF parsing, OCR, and jsPDF paths are dynamically loaded. Long reader sections use `content-visibility`.
- Groq requests use a 45-second timeout, independent cancellation, two-request map concurrency, omitted browser credentials/referrer, and fixed provider error messages.
- Keys, documents, analyses, and chat stay in tab memory. The UI explicitly discloses that selected context and the BYOK credential are transmitted to Groq.
- CSP/COOP/CORP/HSTS/nosniff/frame/referrer/permissions headers are configured. OCR worker/model/core assets are same-origin.
- The complete findings, evidence, remediation, and remaining risk are in `docs/security-findings.md`. No vulnerability-free claim is made.

## Verification evidence

| Check | Result |
|---|---|
| ESLint | Passed |
| Strict TypeScript + production build | Passed |
| Vitest | 41/41 passed across 10 files; 1.79 s recorded combined run |
| Static security regression | Passed |
| Production dependency audit | 0 vulnerabilities |
| Registry signatures | 263 packages verified; 100 attestations verified |
| Playwright primary flow | 8/8 passed; desktop and Pixel 7; 1.2 min recorded run |
| Automated accessibility | No serious/critical WCAG A/AA axe violations on Studio route in either browser project |
| Current Vercel production headers | 2/2 passed; HTTP 200 on `miniproject2-peach.vercel.app` |
| MiniProject1 mutation check | Clean; reference commit `66e6a8f` remained read-only |

The browser suite uses a mocked Groq response so it validates request/response integration and UI behavior without spending a real key. It does not establish model accuracy. The Vercel domain currently serves an older repository revision; only its availability and response headers were validated, not the new local features.

## Performance and bundle observations

- Baseline main application chunk: 104.82 kB (33.58 kB gzip).
- Delivered `AppShell` component chunk: 134.42 kB (41.98 kB gzip), plus shared React (17.82 kB gzip), Zod (24.64 kB gzip), and Motion (41.55 kB gzip) vendor chunks. This is not a one-to-one comparison with the baseline bundle layout; the complete Studio route remains heavier because of integrated schemas, retrieval, evidence UI, multi-document state, and orchestration.
- PDF extraction is split from the route; the pdf.js worker is 436.44 kB (131.07 kB gzip).
- jsPDF is lazy: 386.23 kB (126.41 kB gzip), loaded only on PDF export.
- OCR orchestration is lazy; its local worker/core/language files are large (roughly 9.8 MB uncompressed combined) and load only when OCR is requested. Immutable caching is configured for `/ocr/*`.

The functionality gain is measurable, but first-entry JavaScript is larger than the baseline. Further reduction should split AI schemas/orchestration from the Studio route and replace remote Google font CSS with a reviewed self-hosted subset.

## Benchmark status and limitations

- Deterministic coverage, retrieval ordering, exact citation validity, support classification, report formatting, prompt boundaries, storage behavior, and UI integration are tested.
- The deterministic engineering benchmark generated six source-preserving chunks, ranked the synthetic answer-bearing chunk first, accepted both valid citations, rejected both invalid citations, and completed the 300,000-character text pass within its 100 ms threshold on the recorded run. These are synthetic engineering checks, not comparative model-quality scores.
- Live summary correctness/completeness, Q&A answer accuracy, quiz accuracy, Groq tokens/cost, and model latency: **not run**.
- OCR accuracy over a labeled scan corpus and browser peak-memory benchmarks: **not run**.
- No area is reported as numerically better without a measured result.

## Remaining recommendations

1. Run the controlled benchmark corpus with the same Groq model/account/network against both applications, with at least three generative trials.
2. Commit and review this change set, then deploy it before running full production feature tests; the existing live domain is an older revision.
3. Add embedding retrieval only if benchmarked paraphrase recall materially underperforms lexical retrieval.
4. Consider a privacy-reviewed backend proxy only for managed organizational credentials/rate controls; keep BYOK as the no-backend mode.
5. Add durable encrypted workspace storage only as an explicit opt-in feature with retention controls.
