import { expect, test, type Page, type Route } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PROVIDER_URL = '**/api/ai'

async function fulfillProvider(route: Route, content: unknown) {
  const request = route.request().postDataJSON() as { action?: string }
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(request.action === 'models'
      ? { data: [{ id: 'llama-3.3-70b-versatile', active: true, context_window: 131072 }] }
      : { choices: [{ message: { content: JSON.stringify(content) } }] }),
  })
}

async function addKey(page: Page) {
  const input = page.locator('#groq-key')
  await input.waitFor({ state: 'attached' })
  const openSettings = page.getByRole('button', { name: 'Open settings' })
  if (await openSettings.isVisible()) await openSettings.click()
  await input.fill('browser-test-key')
  await page.locator('label').filter({ hasText: 'Allow API usage' }).locator('input[type="checkbox"]').check()
  if (await page.getByRole('button', { name: 'Close settings' }).isVisible()) await page.keyboard.press('Escape')
}

test.describe('evidence-first workspace', () => {
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
