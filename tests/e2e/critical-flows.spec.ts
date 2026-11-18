import { expect, test, type Page, type Route } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PROVIDER_URL = '**/api/ai'
const SAVED_KEYS_STORAGE = 'doclense.saved-provider-keys.v1'
const COMPATIBLE_PROBE = {
  compatible: true,
  title: 'Schema check',
  oneLiner: 'All required fields are present.',
  summary: { text: 'Evidence is present.', citations: [{ sourceId: 's1', excerpt: 'Evidence is present.' }] },
  keyPoints: [{ text: 'Evidence is present.', citations: [{ sourceId: 's1', excerpt: 'Evidence is present.' }] }],
  keywords: ['evidence', 'schema'],
  sentiment: { label: 'Neutral', score: 0, confidence: 100, summary: 'The tone is neutral.', tones: ['neutral'] },
  quiz: [{ question: 'What is present?', options: ['Evidence', 'Noise', 'Nothing', 'Unknown'], answer: 0, explanation: 'The source says evidence is present.', difficulty: 'easy', citations: [{ sourceId: 's1', excerpt: 'Evidence is present.' }] }],
  answer: { text: 'Evidence is present.', citations: [{ sourceId: 's1', excerpt: 'Evidence is present.' }] },
  digests: [{ chunkId: 'c1', overview: 'Evidence is present.', claims: [{ text: 'Evidence is present.', citations: [{ sourceId: 's1', excerpt: 'Evidence is present.' }] }], keywords: ['evidence'] }],
}

async function openProviderSettings(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) >= 1024) return
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(page.getByRole('complementary', { name: 'Analysis settings' })).toBeInViewport()
}

async function fulfillProvider(route: Route, content: unknown) {
  const request = route.request().postDataJSON() as { action?: string; payload?: { messages?: Array<{ content?: string }> } }
  const verification = request.payload?.messages?.some(message => message.content?.includes('"compatible":true'))
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(request.action === 'models'
      ? { data: [{ id: 'openai/gpt-oss-120b', active: true, context_window: 131072, max_completion_tokens: 65_536 }] }
      : { choices: [{ message: { content: JSON.stringify(verification ? COMPATIBLE_PROBE : content) } }] }),
  })
}

async function addKey(page: Page) {
  const input = page.locator('#groq-key')
  await input.waitFor({ state: 'attached' })
  await openProviderSettings(page)
  await input.fill('browser-test-key')
  await page.locator('label').filter({ hasText: 'Allow API usage' }).locator('input[type="checkbox"]').check()
  await expect(page.getByRole('combobox', { name: 'Verified model' })).toContainText('openai/gpt-oss-120b')
  if (await page.getByRole('button', { name: 'Close settings' }).isVisible()) await page.keyboard.press('Escape')
}

test.describe('evidence-first workspace', () => {
  test('shows only live-verified models in the searchable picker', async ({ page }) => {
    await page.route(PROVIDER_URL, async route => {
      const request = route.request().postDataJSON() as { action?: string; payload?: { model?: string } }
      if (request.action === 'models') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [
          { id: 'openai/gpt-oss-120b', active: true, context_window: 131_072, max_completion_tokens: 65_536 },
          { id: 'openai/gpt-oss-20b', active: true, context_window: 131_072, max_completion_tokens: 65_536 },
          { id: 'vendor/retired-chat', active: true, context_window: 32_768 },
          { id: 'whisper-large-v3', active: true, context_window: 448 },
        ] }) })
        return
      }
      if (request.payload?.model === 'vendor/retired-chat') {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { category: 'model', message: 'Model unavailable.' } }) })
        return
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(COMPATIBLE_PROBE) } }] }) })
    })
    await page.goto('/#/app')
    await addKey(page)
    await openProviderSettings(page)

    const picker = page.getByRole('combobox', { name: 'Verified model' })
    await picker.click()
    await page.getByRole('textbox', { name: 'Search verified models' }).fill('20b')
    await expect(page.getByRole('option', { name: /openai\/gpt-oss-20b/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /vendor\/retired-chat/ })).toHaveCount(0)
    await expect(page.getByRole('option', { name: /whisper-large-v3/ })).toHaveCount(0)
    await page.getByRole('option', { name: /openai\/gpt-oss-20b/ }).click()
    await expect(picker).toContainText('openai/gpt-oss-20b')
    await expect(page.getByText('2 verified · 2 unavailable or incompatible.')).toBeVisible()
  })

  test('saves, restores, updates, and removes an API key only on explicit request', async ({ page }) => {
    await page.goto('/#/app')
    await openProviderSettings(page)

    const input = page.locator('#groq-key')
    await expect(input).toHaveAttribute('type', 'password')
    await input.fill('gsk-browser-saved-one')
    expect(await page.evaluate(key => localStorage.getItem(key), SAVED_KEYS_STORAGE)).toBeNull()

    await page.getByRole('button', { name: 'Save Groq API key in this browser' }).click()
    await expect(page.getByText('Saved in this browser', { exact: true })).toBeVisible()
    expect(await page.evaluate(key => localStorage.getItem(key), SAVED_KEYS_STORAGE)).toContain('gsk-browser-saved-one')

    await page.reload()
    await openProviderSettings(page)
    await expect(input).toHaveValue('gsk-browser-saved-one')
    await expect(input).toHaveAttribute('type', 'password')
    await expect(page.getByText('Browser-local storage is not fully secure. Do not save keys on a shared device.')).toBeVisible()

    await input.fill('gsk-browser-saved-two')
    await expect(page.getByText('Saved copy differs · update to keep changes')).toBeVisible()
    await page.getByRole('button', { name: 'Update Groq API key in this browser' }).click()
    const updated = await page.evaluate(key => localStorage.getItem(key), SAVED_KEYS_STORAGE)
    expect(updated).toContain('gsk-browser-saved-two')
    expect(updated).not.toContain('gsk-browser-saved-one')

    await page.getByRole('button', { name: 'Remove Groq API key from this browser' }).click()
    await expect(input).toHaveValue('')
    await expect(page.getByText('Memory-only · cleared on reload')).toBeVisible()
    expect(await page.evaluate(key => localStorage.getItem(key), SAVED_KEYS_STORAGE)).toBeNull()
  })

  test('uploads, analyzes, opens exact evidence, and keeps secrets out of storage', async ({ page }) => {
    await page.route(PROVIDER_URL, route => fulfillProvider(route, {
      title: 'Evidence-backed result',
      oneLiner: 'Every claim links to a source.',
      summary: {
        text: 'Quarterly revenue increased by twelve percent.',
        citations: [{ sourceId: 'evidence-txt-1:para-1', excerpt: 'Quarterly revenue increased by twelve percent.' }],
      },
    }))
    await page.goto('/#/app')
    await addKey(page)
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'evidence.txt', mimeType: 'text/plain', buffer: Buffer.from('Quarterly revenue increased by twelve percent.') })
    await expect(page.getByRole('button', { name: /evidence\.txt TEXT/ })).toBeVisible()
    await page.getByRole('button', { name: 'Summary only' }).click()
    await page.getByRole('button', { name: 'Generate analysis' }).click()

    await expect(page.getByRole('heading', { name: 'Evidence-backed result' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Analysis coverage' })).toContainText('Complete-document analysis')
    await page.getByRole('button', { name: /Open verified evidence from evidence\.txt · Paragraph 1/ }).click()
    const reader = page.getByRole('dialog', { name: 'Document evidence reader' })
    await expect(reader.locator('[data-source-id="evidence-txt-1:para-1"] mark.rounded')).toHaveText('Quarterly revenue increased by twelve percent.')

    const storage = await page.evaluate(() => JSON.stringify({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }))
    expect(storage).not.toContain('browser-test-key')
    expect(storage).not.toContain('Quarterly revenue')
  })

  test('keeps verified output visible and offers a targeted retry when one section fails', async ({ page }) => {
    await page.route(PROVIDER_URL, async route => {
      const request = route.request().postDataJSON() as { action?: string; payload?: { messages?: Array<{ content?: string }> } }
      const verification = request.payload?.messages?.some(message => message.content?.includes('"compatible":true'))
      if (request.action === 'models') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'openai/gpt-oss-120b', active: true, context_window: 131072, max_completion_tokens: 4096 }] }) })
        return
      }
      const system = request.payload?.messages?.[0]?.content ?? ''
      const content = verification
        ? COMPATIBLE_PROBE
        : system.includes('title, oneLiner, summary, sentiment')
          ? {
              title: 'Verified partial result',
              oneLiner: 'The summary passed evidence validation.',
              summary: { text: 'Quarterly revenue increased by twelve percent.', citations: [{ sourceId: 'partial-txt-1:para-1', excerpt: 'Quarterly revenue increased by twelve percent.' }] },
              sentiment: { label: 'Neutral' },
            }
          : { sentiment: { label: 'Neutral' } }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }) })
    })
    await page.goto('/#/app')
    await addKey(page)
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'partial.txt', mimeType: 'text/plain', buffer: Buffer.from('Quarterly revenue increased by twelve percent.') })
    await page.getByRole('button', { name: 'Summary only' }).click()
    await page.getByRole('checkbox', { name: /Sentiment Tone & polarity/ }).click()
    await page.getByRole('button', { name: 'Generate analysis' }).click()

    await expect(page.getByRole('heading', { name: 'Verified partial result' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('Verified results were kept')
    await expect(page.getByRole('button', { name: 'Retry failed sections' })).toBeVisible()
  })

  test('asks across multiple documents and distinguishes the cited source', async ({ page }) => {
    let lastChatBody = ''
    await page.route(PROVIDER_URL, async route => {
      const request = route.request().postDataJSON() as { action?: string; payload?: unknown }
      if (request.action === 'chat') lastChatBody = JSON.stringify(request.payload)
      await fulfillProvider(route, {
      text: 'The second document sets the deadline to Friday.',
      citations: [{ sourceId: 'delivery-txt-2:para-1', excerpt: 'The delivery deadline is Friday.' }],
      })
    })
    await page.goto('/#/app')
    await addKey(page)
    await page.locator('input[type="file"]').first().setInputFiles([
      { name: 'overview.txt', mimeType: 'text/plain', buffer: Buffer.from('The project is a document intelligence application.') },
      { name: 'delivery.txt', mimeType: 'text/plain', buffer: Buffer.from('The delivery deadline is Friday.') },
    ])
    await expect(page.getByLabel('Document workspace')).toContainText('2 selected')
    await page.getByRole('checkbox', { name: 'Exclude overview.txt from analysis' }).click()
    await expect(page.getByLabel('Document workspace')).toContainText('1 selected')
    await page.getByLabel('Ask a question about the selected documents').fill('When is the delivery deadline?')
    await page.getByRole('button', { name: 'Send question' }).click()
    await expect(page.getByText('The second document sets the deadline to Friday.')).toBeVisible()
    await expect(page.getByRole('button', { name: /delivery\.txt · Paragraph 1/ })).toBeVisible()
    expect(lastChatBody).toContain('The delivery deadline is Friday.')
    expect(lastChatBody).not.toContain('document intelligence application')
  })

  test('supports keyboard focus and the responsive mobile layout', async ({ page }) => {
    await page.goto('/#/app')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(focused).not.toBe('BODY')
    await expect(page.getByText('Build your evidence workspace')).toBeVisible()
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll')
  })

  test('collapses sidebar categories without losing active settings', async ({ page }) => {
    await page.goto('/#/app')
    const openSettings = page.getByRole('button', { name: 'Open settings' })
    if ((page.viewportSize()?.width ?? 1280) < 1024) {
      await expect(openSettings).toBeVisible()
      await openSettings.click()
    }

    const aiSetup = page.getByRole('button', { name: /AI setup/ })
    const analysisScope = page.getByRole('button', { name: /Analysis scope/ })
    const generationControls = page.getByRole('button', { name: /Generation controls/ })
    const outputPreferences = page.getByRole('button', { name: /Output preferences/ })
    const recentAnalyses = page.getByRole('button', { name: /Recent analyses/ })

    await expect(aiSetup).toHaveAttribute('aria-expanded', 'true')
    await expect(analysisScope).toHaveAttribute('aria-expanded', 'true')
    await expect(generationControls).toHaveAttribute('aria-expanded', 'false')
    await expect(outputPreferences).toHaveAttribute('aria-expanded', 'false')
    await expect(recentAnalyses).toHaveAttribute('aria-expanded', 'false')

    await analysisScope.click()
    await expect(analysisScope).toHaveAttribute('aria-expanded', 'false')
    await generationControls.click()
    await expect(page.getByLabel('Temperature')).toBeVisible()

    await outputPreferences.click()
    await page.getByRole('radio', { name: 'Detailed' }).click()
    await page.getByRole('radio', { name: '10 questions' }).click()
    await expect(page.getByRole('radio', { name: 'Detailed' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: '10 questions' })).toHaveAttribute('aria-checked', 'true')
    await outputPreferences.click()
    await outputPreferences.click()
    await expect(page.getByRole('radio', { name: 'Detailed' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: '10 questions' })).toHaveAttribute('aria-checked', 'true')
  })

  test('has no serious or critical automated accessibility violations', async ({ page }) => {
    await page.goto('/#/app')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const blocking = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
  })

  test('renders adversarial document and model strings as inert text', async ({ page }) => {
    const attack = '<img src=x onerror="window.__doclenseXss=1"> Verified evidence.'
    await page.route(PROVIDER_URL, route => fulfillProvider(route, {
      title: '<svg onload="window.__doclenseXss=2">Safe title',
      oneLiner: 'Untrusted markup remains text.',
      summary: {
        text: attack,
        citations: [{ sourceId: 'xss-txt-1:para-1', excerpt: attack }],
      },
    }))
    await page.goto('/#/app')
    await addKey(page)
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'xss.txt', mimeType: 'text/plain', buffer: Buffer.from(attack) })
    await page.getByRole('button', { name: 'Summary only' }).click()
    await page.getByRole('button', { name: 'Generate analysis' }).click()
    await expect(page.getByRole('heading', { name: /Safe title/ })).toBeVisible()
    await expect(page.getByText(attack, { exact: true })).toBeVisible()
    expect(await page.locator('img[src="x"], svg[onload]').count()).toBe(0)
    expect(await page.evaluate(() => (window as typeof window & { __doclenseXss?: number }).__doclenseXss)).toBeUndefined()
  })

  test('rejects extension-spoofed and structurally malformed PDFs without crashing', async ({ page }) => {
    await page.goto('/#/app')
    const input = page.locator('input[type="file"]').first()
    await input.setInputFiles({ name: 'spoofed.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') })
    await expect(page.getByText('This file was stopped for safety')).toBeVisible()
    await expect(page.getByText(/does not contain a valid PDF header/)).toBeVisible()

    await input.setInputFiles({ name: 'malformed.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nmalformed') })
    await expect(page.getByText('Could not read this file')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/corrupt, password-protected, or malformed/)).toBeVisible()
    await expect(page.getByText('Build your evidence workspace')).toBeVisible()
  })
})
