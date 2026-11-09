import { expect, test } from '@playwright/test'

test('production deployment sends required security headers', async ({ request }) => {
  const deploymentUrl = process.env.DEPLOYMENT_URL
  test.skip(!deploymentUrl, 'DEPLOYMENT_URL is required for deployed-header verification.')
  const response = await request.get(deploymentUrl!)
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(response.headers()['x-content-type-options']).toBe('nosniff')
  expect(response.headers()['referrer-policy']).toBe('no-referrer')
  expect(response.headers()['cross-origin-opener-policy']).toBe('same-origin')
})
