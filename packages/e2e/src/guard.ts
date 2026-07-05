import type { Page, ElementHandle } from './connect'

/**
 * Matches a page's hostname. A string matches the hostname exactly; a RegExp
 * is tested against it.
 */
export type OriginMatcher = string | RegExp

/**
 * Hostnames where mutation is permitted by default: local development only.
 * Anything else (i.e. anything that looks like a real deployment) is refused
 * unless the caller explicitly widens the allowlist.
 */
export const DEFAULT_ALLOWED: OriginMatcher[] = [
  'localhost',
  '127.0.0.1',
  '[::1]',
  '::1',
  /\.local$/,
  /\.test$/,
  /\.localhost$/,
]

/**
 * Extracts the hostname from a URL, falling back to the raw string when it
 * can't be parsed (e.g. a bare host with no scheme).
 */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname || url
  } catch {
    return url
  }
}

/**
 * Returns whether mutation is allowed against the given URL's origin.
 * `file:` URLs are always allowed; otherwise the hostname must match the
 * allowlist. An unparseable/empty origin is refused.
 *
 * @param url - The URL whose origin is being checked
 * @param allow - Allowed origin matchers (defaults to {@link DEFAULT_ALLOWED})
 */
export function isMutationAllowed(
  url: string,
  allow: OriginMatcher[] = DEFAULT_ALLOWED
): boolean {
  let host = url
  let protocol = ''
  try {
    const parsed = new URL(url)
    host = parsed.hostname
    protocol = parsed.protocol
  } catch {
    // keep raw string as host
  }

  if (protocol === 'file:') return true
  if (!host) return false

  return allow.some((matcher) =>
    typeof matcher === 'string' ? matcher === host : matcher.test(host)
  )
}

/**
 * Options controlling the mutation policy applied by {@link guardPage}.
 */
export interface GuardOptions {
  /**
   * Enable mutating methods (`click`, `type`, `goto`). When false (default),
   * the page is read-only and any mutation throws.
   * @default false
   */
  mutate?: boolean
  /**
   * Origins where mutation is permitted when `mutate` is true.
   * @default DEFAULT_ALLOWED (local development only)
   */
  allowMutationOn?: OriginMatcher[]
}

/**
 * Wraps a {@link Page} to enforce contest's mutation policy.
 *
 * Observation methods (`title`, `url`, `content`, `$eval`, `$$eval`, `$`, `$$`,
 * `waitForSelector`, `screenshot`) always pass through. Mutating methods
 * (`goto`, `click`, `type`, and the same on returned {@link ElementHandle}s)
 * throw unless `mutate` is true **and** the relevant origin is on the
 * allowlist — so a read-only test can never silently interact with a live,
 * possibly-production tab.
 *
 * @param page - The underlying page to wrap
 * @param options - Mutation policy
 * @returns A policy-enforcing page with the same interface
 */
export function guardPage(page: Page, options: GuardOptions = {}): Page {
  const { mutate = false, allowMutationOn } = options
  const allow = allowMutationOn ?? DEFAULT_ALLOWED

  const assertMutable = (origin: string, method: string): void => {
    if (!mutate) {
      throw new Error(
        `contest: page.${method}() is a mutation and this test is read-only. ` +
          `Pass { mutate: true } to withPage() to enable interactions.`
      )
    }
    if (!isMutationAllowed(origin, allow)) {
      throw new Error(
        `contest: refusing page.${method}() on "${hostOf(origin)}" — not on ` +
          `the mutation allowlist (looks like production). Add it via ` +
          `allowMutationOn if this is intentional.`
      )
    }
  }

  const guardHandle = (handle: ElementHandle | null): ElementHandle | null => {
    if (!handle) return handle
    return {
      async click() {
        assertMutable(page.url(), 'click')
        return handle.click()
      },
      async type(text: string) {
        assertMutable(page.url(), 'type')
        return handle.type(text)
      },
    }
  }

  return {
    // Observation — always allowed.
    title: () => page.title(),
    url: () => page.url(),
    content: () => page.content(),
    screenshot: (opts) => page.screenshot(opts),
    $eval<T>(selector: string, fn: (el: Element) => T): Promise<T> {
      return page.$eval(selector, fn)
    },
    $$eval<T>(selector: string, fn: (els: Element[]) => T): Promise<T> {
      return page.$$eval(selector, fn)
    },
    async $(selector: string): Promise<ElementHandle | null> {
      return guardHandle(await page.$(selector))
    },
    async $$(selector: string): Promise<ElementHandle[]> {
      const handles = await page.$$(selector)
      return handles.map((h) => guardHandle(h)!)
    },
    async waitForSelector(selector: string): Promise<ElementHandle | null> {
      return guardHandle(await page.waitForSelector(selector))
    },

    // Mutation — gated. `goto` is checked against the target origin; the
    // others against the tab's current origin. These are async so a refusal
    // surfaces as a rejected promise, honoring the `Promise` return contract.
    async goto(url: string): Promise<unknown> {
      assertMutable(url, 'goto')
      return page.goto(url)
    },
    async click(selector: string): Promise<void> {
      assertMutable(page.url(), 'click')
      return page.click(selector)
    },
    async type(selector: string, text: string): Promise<void> {
      assertMutable(page.url(), 'type')
      return page.type(selector, text)
    },
    async close(): Promise<void> {
      // Closing the attached tab is destructive; gate it like any mutation.
      assertMutable(page.url(), 'close')
      return page.close()
    },
  }
}
