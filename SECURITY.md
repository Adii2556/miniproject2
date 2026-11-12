# DocLense security policy

## Data flow and secrets

- Groq, NVIDIA, DeepSeek, and OpenAI keys are held only in React memory. They are never written to local/session storage, build-time variables, history, exports, or application logs.
- The browser sends a selected key to the same-origin `/api/ai` gateway in a transient request header. The gateway forwards it only as the `Authorization` header to the selected allowlisted provider. Deployment operators must keep request-header logging disabled.
- Documents, analyses, chat, and verified-map caches are tab-memory data. Reloading clears them; map-cache keys include the exact document scope and chunk content so changed scopes cannot reuse stale work. Theme, non-sensitive analysis settings, provider order, and model IDs may persist locally. Model catalogs have a 15-minute session cache and contain no credentials or document text.
- PDF parsing, statistics, retrieval, citation matching, report generation, and optional OCR run in the browser. OCR worker, model, and WASM assets are served from the DocLense origin.
- Model discovery, compatibility tests, analysis, and Q&A contact a provider only after that provider has explicit API/document-sharing consent. Analysis and Q&A transmit only the selected bounded context and instruction.

## Security boundaries

- `/api/ai` accepts same-origin JSON POSTs with a DocLense request marker, omits cookies, rejects cross-site browser requests, and exposes no CORS allow-origin response.
- Provider URLs are constants selected from a four-provider allowlist. Client-controlled URLs, arbitrary payload fields, streaming, excessive output budgets, unsupported roles, oversized requests/responses, and invalid models/messages are rejected before upstream access.
- The gateway applies per-instance request/concurrency limits, a 45-second upstream deadline, a 5 MB response limit, redirect denial, no-store responses, and sanitized error messages. Client requests also use a two-request queue with a bounded backlog and retries.
- File type/signature, size, page, extracted-character, canvas-pixel, OCR, timeout, retry, and concurrency limits bound resource use. PDF and OCR operations are actively cancelled on deadline or user abort.
- Document text is serialized as untrusted JSON data in model messages. Instruction-like content raises a visible warning. Prompt isolation reduces but cannot eliminate indirect prompt injection.
- AI output is schema-validated and rendered as React text. Raw HTML/eval rendering is prohibited by regression checks and browser attack tests.
- Exact cited excerpts must resolve to their named source. Lexically weak claim support is visibly marked uncertain; this remains a heuristic, not semantic proof.
- CSP restricts browser connections to the DocLense origin, denies framing/plugins, and limits workers. Equivalent policies are provided in `vercel.json`, `public/_headers`, and the HTML fallback CSP.

## Operational requirements

- Deploy only over HTTPS and preserve the configured response headers.
- Add durable edge/WAF rate limiting for high-traffic or adversarial public deployments; the built-in limiter is best-effort and per serverless instance.
- Do not enable request-body or sensitive-header logging on `/api/ai`. Redact `X-DocLense-Provider-Key` in platform and observability tooling.
- Run `npm run check`, `npm audit --audit-level=low`, and `npm run test:e2e` before release. Verify deployed headers with `DEPLOYMENT_URL=https://… npm run test:headers`.

The current evidence-backed register is in [docs/security-findings.md](docs/security-findings.md). DocLense does not claim to be vulnerability-free. Report suspected vulnerabilities privately to the repository owner.
