import { expect, test, type Page, type Route } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const GROQ_URL = 'https://api.groq.com/**'

async function fulfillGroq(route: Route, content: unknown) {
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
  })
}

async function addKey(page: Page) {
  const input = page.locator('#groq-key')
  await input.waitFor({ state: 'attached' })
  if (!(await input.isVisible())) await page.getByRole('button', { name: 'Open settings' }).click()
  await input.fill('browser-test-key')
  if (await page.getByRole('button', { name: 'Close settings' }).isVisible()) await page.keyboard.press('Escape')
}

test.describe('evidence-first workspace', () => {
  test('uploads, analyzes, opens exact evidence, and keeps secrets out of storage', async ({ page }) => {
    await page.route(GROQ_URL, route => fulfillGroq(route, {
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
    await expect(page.getByTitle('evidence.txt')).toBeVisible()
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
    await page.route(GROQ_URL, route => fulfillGroq(route, {
      text: 'The second document sets the deadline to Friday.',
      citations: [{ sourceId: 'delivery-txt-2:para-1', excerpt: 'The delivery deadline is Friday.' }],
    }))
    await page.goto('/#/app')
    await addKey(page)
    await page.locator('input[type="file"]').first().setInputFiles([
      { name: 'overview.txt', mimeType: 'text/plain', buffer: Buffer.from('The project is a document intelligence application.') },
      { name: 'delivery.txt', mimeType: 'text/plain', buffer: Buffer.from('The delivery deadline is Friday.') },
    ])
    await expect(page.getByLabel('Documents in workspace')).toContainText('2 sources')
    await page.getByLabel('Ask a question about the selected documents').fill('When is the delivery deadline?')
    await page.getByRole('button', { name: 'Send question' }).click()
    await expect(page.getByText('The second document sets the deadline to Friday.')).toBeVisible()
    await expect(page.getByRole('button', { name: /delivery\.txt · Paragraph 1/ })).toBeVisible()
  })

  test('supports keyboard focus and the responsive mobile layout', async ({ page }) => {
    await page.goto('/#/app')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(focused).not.toBe('BODY')
    await expect(page.getByText('Build your evidence workspace')).toBeVisible()
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll')
  })

  test('has no serious or critical automated accessibility violations', async ({ page }) => {
    await page.goto('/#/app')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const blocking = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
  })
})
