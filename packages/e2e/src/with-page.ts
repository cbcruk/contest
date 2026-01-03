import type { Page } from './connect'

export interface WithPageOptions {
  url?: string
  newTab?: boolean
}

export type PageTestFn = (page: Page) => Promise<void>

/**
 * Wraps an async test function to provide a Puppeteer page object.
 * Use inside `it()` blocks for E2E tests.
 *
 * @param fn - Async function that receives a Page object
 * @param options - Optional configuration
 * @returns Wrapped function compatible with contest's `it()`
 *
 * @example
 * ```typescript
 * import { describe, it, expect } from '@contest/core'
 * import { withPage } from '@contest/e2e'
 *
 * describe('Login', () => {
 *   it('shows form', withPage(async (page) => {
 *     await page.goto('/login')
 *     const form = await page.$('form')
 *     expect(form).toBeTruthy()
 *   }))
 *
 *   it('navigates to signup', withPage(async (page) => {
 *     await page.goto('/signup')
 *     expect(page.url()).toContain('/signup')
 *   }, { url: '/signup', newTab: true }))
 * })
 * ```
 */
export function withPage(
  fn: PageTestFn,
  options: WithPageOptions = {}
): () => Promise<void> {
  return async (): Promise<void> => {
    const { connect, ExtensionTransport } = await import(
      'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js'
    )

    const { url, newTab = false } = options

    let tabId: number

    if (newTab && url) {
      const tab = await chrome.tabs.create({ url })

      if (!tab.id) throw new Error('Failed to create tab')

      tabId = tab.id
    } else {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })

      if (!tab.id) throw new Error('No active tab')

      tabId = tab.id
    }

    const transport = await ExtensionTransport.connectTab(tabId)
    const browser = await connect({ transport })
    const [page] = await browser.pages()

    if (url && !newTab) {
      await page.goto(url)
    }

    try {
      await fn(page as Page)
    } finally {
      browser.disconnect()

      if (newTab) {
        await chrome.tabs.remove(tabId)
      }
    }
  }
}
