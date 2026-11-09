import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('security regression boundaries', () => {
  test('keeps CSP restricted and Groq as the only external API origin', () => {
    const headers = read('public/_headers')
    expect(headers).toContain("script-src 'self'")
    expect(headers).toContain("connect-src 'self' https://api.groq.com")
    expect(headers).toContain("frame-ancestors 'none'")
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
})
