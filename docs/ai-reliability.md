# AI generation reliability

## Pipeline

DocLense extracts and safety-checks each document, creates stable source blocks, and either sends a short document directly or maps selected 10,000-character chunks into evidence digests. Generation requests pass through the same-origin `/api/ai` gateway, provider-specific Chat Completions adapters, strict JSON parsing, section-specific Zod validation, exact source-excerpt validation, and finally the results UI.

## Root causes fixed

- The former combined response schema made every field optional, then rejected the entire response when one requested field was absent. A missing `title` therefore discarded a valid summary and every other valid section.
- The prompt said to return only the selected section names while separately requiring `title` and `oneLiner`. For summary generation those instructions contradicted each other.
- One static output budget covered every possible selection. A 15-question quiz and all other outputs could exceed the gateway's 4,096-token ceiling, while provider-reported output limits were ignored.
- A non-empty response with `finish_reason: "length"` was accepted and handed to the JSON parser. Transport retries then repeated the same oversized request instead of allowing section-level recovery.
- Large-document mapping accepted a subset of the requested chunk IDs. Failed map batches were converted to empty arrays and synthesis could report coverage for evidence it never received.
- One generic validation repair regenerated the entire response, wasting verified work and provider quota.

## Current behavior

- Summary, key points, keywords, sentiment, and quiz use independent, prompt-aligned schemas. Summary explicitly requires `title`, `oneLiner`, and `summary`; key points require 5–7 cited items; keywords require 8–12 distinct topics; sentiment bounds scores and requires 2–4 tones.
- Output batches are planned from selected sections, summary style, quiz count, the user's output setting, the gateway ceiling, and discovered model metadata. Quizzes are generated in distinct five-question batches.
- A combined response is validated field by field. Only failed fields are retried, once, with a focused schema. Successfully evidence-checked fields are preserved and rendered.
- `length` and `max_tokens` finish reasons are treated as truncation even when partial content exists. Rate limits, temporary failures, and network failures retain bounded transport retries; malformed output is owned by the validation/recovery layer.
- Every mapped chunk ID must be returned exactly once with valid citations. A failed two-chunk batch is retried per chunk; synthesis is blocked if any selected chunk is still missing.
- The UI labels partial completion, lists the failed sections without raw provider content, and offers a targeted retry. A total validation failure is never displayed as success.

## Provider compatibility boundary

Models are discovered from each provider's official model endpoint and are selectable only after a live DocLense-shaped compatibility probe succeeds. Runtime requests keep provider-specific token parameter names, JSON mode, reasoning-model handling, consent, fallback order, and key isolation. Catalog metadata is treated as a limit hint, not proof of capability; the live probe remains authoritative.

## Verification matrix

Automated coverage includes malformed JSON, missing summary fields, partial success, invalid citations, non-empty truncated responses, exact chunk coverage, provider/model failures, invalid keys, all five outputs separately and together, 5/10/15-question quizzes, short and long inputs, multi-document Q&A, security checks, build/type checking, and browser flows. Live provider calls require user-owned credentials and are not run by the repository test suite; no provider is claimed live solely from mocks.
