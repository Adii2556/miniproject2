# Security findings register

Status reflects this source tree and the verification commands recorded in the final delivery. Severity is based on exploitability and impact within a client-only BYOK application.

| ID | Severity | Finding and source evidence | Remediation | Verification | Remaining risk |
|---|---|---|---|---|---|
| SEC-01 | High | A shared frontend key would be extractable from the bundle. | No shared key exists; BYOK value remains React state and regression checks reject storage/environment patterns. | Storage unit/browser tests and bundle scan. | XSS-capable extensions or a compromised origin can observe tab memory. |
| SEC-02 | High | Long-document prefix truncation could create confidently incomplete output. | Source-preserving chunks, explicit complete/sampled coverage, hard complete-mode refusal, and full-workspace Q&A retrieval. | Document pipeline and mocked browser tests. | Sampled mode is deliberately incomplete and visibly labeled. |
| SEC-03 | High | Malicious document instructions can attempt indirect prompt injection. | Delimited untrusted-data prompts, instruction-like-content warning, schema validation, exact source checks. | Prompt-boundary/security regression tests. | No prompt can guarantee immunity; users must inspect evidence. |
| SEC-04 | Medium | Model-provided citations could quote nonexistent or irrelevant text. | Exact excerpt lookup plus claim/evidence lexical support score; invalid citations removed and weak support marked uncertain. | Citation tamper/support unit tests. | Lexical overlap is not semantic entailment. |
| SEC-05 | Medium | PDF/OCR work can exhaust memory/CPU. | File/signature, pages, extracted characters, canvas pixels, OCR pages/pixels, timeout, and cancellation limits. | File tests, OCR source checks, production build. | A worst-case valid file can still temporarily use substantial browser memory. |
| SEC-06 | Medium | Default OCR asset loading could contact third-party CDNs and leak metadata. | Worker, WASM core, and English model are emitted and served from `/ocr` on the application origin. | Build artifact inspection and CSP `connect-src`. | Hosting logs can still record asset requests, not document pixels. |
| SEC-07 | Medium | Raw provider errors may disclose implementation details or echoed content. | Known errors have fixed messages; other provider bodies are consumed but not displayed. | Groq error unit tests/source review. | Browser developer tools still show network responses to the user. |
| SEC-08 | Medium | Client-rendered AI/document content creates an XSS boundary. | React text rendering only; no raw HTML/eval; CSP denies objects/framing and restricts scripts/connections. | Static security regression and browser CSP checks when deployed. | Third-party dependency compromise remains a supply-chain risk. |
| SEC-09 | High | jsPDF 3.x selected during implementation was covered by a published critical advisory. | Upgraded before delivery to patched 4.2.1 and locked dependencies. | `npm audit --omit=dev`. | Future advisories require Dependabot/CI review. |
| SEC-10 | Medium | Marketing claimed stronger privacy/accuracy than the implementation established. | Replaced fake metrics/testimonial and disclosed Groq transmission, evidence states, OCR, and sampling limits. | Copy review/static search. | Provider-side policies must be reviewed separately by deployers. |
| SEC-11 | Medium | Missing/incorrect deployment headers could weaken browser isolation. | Vercel and `_headers` policies include CSP, COOP, CORP, HSTS, nosniff, frame denial, permissions and referrer policy. | Local config tests; production check requires `DEPLOYMENT_URL`. | Meta CSP cannot enforce all response-header controls. |

## Release blockers

- Any critical/high production audit issue.
- A bundled or persisted API key/document body.
- Citation navigation that resolves to a different source, or complete mode that silently omits chunks.
- Failure of lint, strict TypeScript build, unit/security tests, or the primary desktop/mobile browser flow.

