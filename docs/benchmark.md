# Fair comparison benchmark

## Purpose

This protocol compares MiniProject1 and DocLense without assuming that a more complex implementation is more accurate. No live-model score is recorded until both applications are run with the same documents, model, key/account limits, network conditions, prompts where the product permits, and repeated trial count.

## Corpus

Use redistributable fixtures containing known facts and page-level answers:

1. Short native-text PDF with 10–15 atomic facts.
2. 100+ page PDF with important facts at the beginning, middle, and end.
3. Two documents containing compatible facts for a comparative question.
4. Two documents containing a deliberate contradiction.
5. Image-only English PDF with a manually transcribed answer key.
6. Malformed, oversized, instruction-injected, and quotation-tampered inputs.

Do not commit confidential fixtures or real keys.

## Measures

| Measure | Method |
|---|---|
| Summary correctness/completeness | Two blinded reviewers score atomic claims against the answer key; disagreements are adjudicated. |
| Citation validity | Exact excerpt exists in cited source/page. Report numerator/denominator. |
| Evidence support | Reviewers label supports / partial / does not support, separately from exact-match validity. |
| Q&A/retrieval | Answer accuracy plus recall@k of the known supporting block. |
| Quiz quality | Correct answer, unique option, explanation, and source support per question. |
| Coverage | Analyzed chunks and characters divided by available chunks and characters. |
| Performance | Browser wall time, request count, request/response bytes, peak JS heap where available, and failures. |
| Accessibility | Automated serious/critical violations plus keyboard/mobile task completion. |

Run at least three model trials per generative scenario because model output varies. Record refusals and rate limits as outcomes, not exclusions.

## Results available in this repository

Deterministic unit/security/browser results and bundle sizes are reported in the delivery report. Live Groq factual-quality, latency, token, and cost comparison is **not run** because no credential or controlled benchmark corpus was supplied, and MiniProject1 was required to remain read-only. Those cells must remain `not run`; fabricated estimates are prohibited.

## Result table template

| Scenario | App | Model | Valid citations | Supported claims | Q&A correct | Retrieval recall@k | Latency | Requests/tokens | Errors |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| Native short | MiniProject1 |  | not run | not run | not run | not run | not run | not run | not run |
| Native short | DocLense |  | not run | not run | not run | not run | not run | not run | not run |

