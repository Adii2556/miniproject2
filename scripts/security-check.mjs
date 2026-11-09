import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const failures = []
const assertAbsent = (content, pattern, label) => { if (pattern.test(content)) failures.push(label) }
const assertPresent = (content, pattern, label) => { if (!pattern.test(content)) failures.push(label) }

const indexHtml = read('index.html')
assertAbsent(indexHtml, /arena|designarena|rrweb|postMessage/i, 'Production HTML contains preview, recording, telemetry, or cross-window messaging code.')
assertAbsent(read('vite.config.ts'), /loadEnv|envPrefix|VITE_GROQ_API_KEY/, 'Vite config exposes environment variables to the client.')

const appSource = read('src/pages/AppShell.tsx') + read('src/components/Sidebar.tsx')
assertAbsent(appSource, /localStorage\.(?:getItem|setItem)\([^)]*(?:groq|history)/i, 'Application code persists API keys or document history.')
assertAbsent(appSource, /dangerouslySetInnerHTML/i, 'Application renders untrusted HTML.')

const ocrSource = read('src/lib/ocr.ts')
assertAbsent(ocrSource, /https?:\/\//i, 'OCR runtime loads an unexpected external resource.')
assertPresent(ocrSource, /OCR_MAX_PAGES\s*=\s*10/, 'OCR page budget is missing.')
assertPresent(ocrSource, /OCR_TIMEOUT_MS\s*=\s*180_000/, 'OCR timeout is missing.')

const headers = read('public/_headers')
assertPresent(headers, /Content-Security-Policy:/, 'Content Security Policy is missing.')
assertPresent(headers, /script-src 'self'/, 'CSP permits non-self scripts.')
assertPresent(headers, /connect-src 'self' https:\/\/api\.groq\.com/, 'CSP contains an unexpected network boundary.')
assertPresent(headers, /frame-ancestors 'none'/, 'Anti-framing policy is missing.')
assertPresent(headers, /Cross-Origin-Opener-Policy: same-origin/, 'Opener isolation is missing.')

const collectFiles = (directory) => {
  const absolute = new URL(directory, root)
  try {
    return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
      const relative = join(directory, entry.name)
      return entry.isDirectory() ? collectFiles(`${relative}/`) : [relative]
    })
  } catch {
    return []
  }
}

for (const file of collectFiles('dist/')) {
  const extension = extname(file)
  if (!['.html', '.js', '.mjs'].includes(extension) || statSync(new URL(file, root)).size > 8_000_000) continue
  const content = read(file)
  assertAbsent(content, /gsk_[A-Za-z0-9_-]{24,}/, `Production bundle contains a Groq credential candidate: ${file}`)
  assertAbsent(content, /designarena|rrweb|arena:recording|arena:set-text/i, `Production bundle contains recorder/editor code: ${file}`)
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`SECURITY CHECK FAILED: ${failure}`)
  process.exit(1)
}

console.log('Security regression checks passed.')
