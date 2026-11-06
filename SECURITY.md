# Security

## Data handling

- Groq API keys are held in React memory only. They are never written to localStorage, sessionStorage, build-time environment variables, logs, or the document history.
- Legacy `doclense.groq-key`, `doclense.groq-key-saved`, and `doclense.history.v1` values are removed when the Studio loads.
- Recent analyses are held in memory for the current page session only and disappear on reload.
- Document text is parsed locally and only the bounded model context is sent directly to Groq when the user requests analysis or asks a question.

## Untrusted input boundaries

- PDF uploads require a valid PDF header and are limited by file size, page count, extracted characters, canvas pixels, processing time, and cancellation.
- Plain-text uploads reject binary NUL content and documents above the character limit.
- Uploaded documents are serialized as untrusted data in model requests. Instruction-like content triggers a user warning. This reduces prompt-injection risk but cannot guarantee model correctness; important output must be checked against the source.
- Model output is bounded and rendered through React text nodes. Do not introduce raw HTML rendering for document or model content.

## Deployment

The repository includes equivalent security policies for:

- Vercel in `vercel.json`.
- Static hosts that support a `_headers` file in `public/_headers`.
- A CSP fallback meta element in `index.html`.

If deploying elsewhere, configure the same CSP, frame denial, MIME sniffing protection, referrer policy, permissions policy, and HSTS at the edge or web server. Header-based `frame-ancestors 'none'` is required; a CSP meta element cannot enforce `frame-ancestors`.

## Verification

Before release, run:

```bash
npm ci
npm run lint
npm test
npm run build
npm audit --audit-level=low
npm audit signatures
```

The security regression suite covers prompt boundaries, suspicious-document detection, file signatures and limits, settings normalization, and memory-only history. The cross-origin browser regression additionally verifies that obsolete Arena messages are ignored, legacy sensitive storage is purged, no recorder is loaded, and API keys are not persisted.
