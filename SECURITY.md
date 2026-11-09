# DocLense security policy

## Data flow and secrets

- The Groq key is held only in React memory. It is not written to local/session storage, build-time environment variables, history, logs, or exports.
- Documents, analyses, and chat are tab-memory data. Reloading clears them. Theme and non-sensitive analysis settings may persist locally.
- PDF parsing, statistics, retrieval, citation matching, and optional OCR run in the browser. OCR worker, model, and WASM assets are served from the DocLense origin.
- Starting analysis or Q&A sends the selected bounded document context and user instruction directly to `https://api.groq.com`. DocLense has no backend proxy.

## Security boundaries

- File type/signature, size, page, extracted-character, canvas-pixel, OCR, timeout, retry, and concurrency limits bound resource use.
- Document text is labeled untrusted in model prompts. Instruction-like content raises a visible warning. This reduces but cannot eliminate indirect prompt injection.
- AI output is schema-validated and rendered as React text. Raw HTML rendering is prohibited by regression checks.
- Exact cited excerpts must resolve to their named source. Claim support remains a heuristic and is visibly classified as verified or uncertain.
- CSP restricts connections to the DocLense origin and Groq, denies framing/plugins, and limits workers. Equivalent policies are provided in `vercel.json`, `public/_headers`, and the HTML fallback CSP.
- Requests omit browser credentials and referrers. Provider error bodies are not displayed.

## Verification and disclosure

Run `npm run check`, `npm run audit:prod`, and `npm run test:e2e` before release. Validate response headers against the production URL with `DEPLOYMENT_URL=https://… npm run test:headers`.

The evidence-backed register, including residual risk and release-blocker rules, is in [docs/security-findings.md](docs/security-findings.md). This project does not claim to be vulnerability-free. Report a suspected vulnerability privately to the repository owner rather than opening a public exploit report.
