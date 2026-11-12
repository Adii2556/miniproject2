import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('security regression boundaries', () => {
  test('keeps CSP restricted to the same-origin provider gateway', () => {
    const headers = read('public/_headers')
    const html = read('index.html')
    expect(headers).toContain("script-src 'self'")
    expect(headers).toContain("connect-src 'self';")
    expect(headers).not.toMatch(/connect-src[^;]*api\.(?:groq|openai|deepseek)/)
    expect(headers).toContain("frame-ancestors 'none'")
    expect(html).toContain("connect-src 'self';")
    expect(html).not.toMatch(/connect-src[^;]*(?:api\.groq|integrate\.api\.nvidia|api\.deepseek|api\.openai)/)
  })

  test('self-hosts OCR runtime assets and keeps bounded limits', () => {
    const ocr = read('src/lib/ocr.ts')
    const vite = read('vite.config.ts')
    expect(ocr).not.toMatch(/cdn\.jsdelivr|unpkg\.com|projectnaptha\.com/)
    expect(ocr).toContain('OCR_MAX_PAGES = 10')
    expect(ocr).toContain('OCR_TIMEOUT_MS = 180_000')
    expect(vite).toContain('doclense-local-ocr-assets')
  })

  test('does not render raw model or document HTML', () => {
    const source = read('src/pages/AppShell.tsx') + read('src/components/ResultsView.tsx') + read('src/components/DocumentReader.tsx')
    expect(source).not.toContain('dangerouslySetInnerHTML')
  })

  test('keeps provider credentials out of JSON bodies and validates gateway requests', () => {
    const client = read('src/lib/aiProviders.ts')
    const gateway = read('server/aiProxy.ts')
    expect(client).toContain("'X-DocLense-Provider-Key': validateKey(apiKey)")
    expect(client).not.toMatch(/body:\s*JSON\.stringify\([^)]*apiKey/)
    expect(gateway).toContain('sameOriginRequest')
    expect(gateway).toContain('validateChatPayload')
    expect(gateway).toContain('UPSTREAM_TIMEOUT_MS = 120_000')
    expect(gateway).toContain('MAX_UPSTREAM_RESPONSE_BYTES = 5_000_000')
  })
})
