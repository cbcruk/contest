/**
 * How a buffer names an element.
 *
 * - a string is a CSS selector
 * - a RegExp matches text, via testing-library's ByText
 * - `byRole(...)` and friends are its other queries
 */
export type Target = string | RegExp | Tagged

export interface Tagged {
  readonly __poke: 'target'
  readonly kind: string
  readonly matcher: string | RegExp
  readonly options?: Record<string, unknown>
}

/** What crosses into the page. RegExps are split so they survive the trip. */
export interface Descriptor {
  kind: string
  literal?: string
  source?: string
  flags?: string
  options?: Record<string, unknown>
  regexpOptions?: Record<string, { source: string; flags: string }>
}

const isTagged = (t: Target): t is Tagged =>
  typeof t === 'object' && t !== null && (t as Tagged).__poke === 'target'

function matcherParts(m: string | RegExp): Pick<Descriptor, 'literal' | 'source' | 'flags'> {
  return typeof m === 'string' ? { literal: m } : { source: m.source, flags: m.flags }
}

export function describeTarget(t: Target): string {
  if (typeof t === 'string') return `"${t}"`
  if (t instanceof RegExp) return String(t)
  const name = t.options?.name
  const suffix = name === undefined ? '' : `, { name: ${String(name)} }`
  return `by${t.kind[0].toUpperCase()}${t.kind.slice(1)}(${
    typeof t.matcher === 'string' ? `"${t.matcher}"` : String(t.matcher)
  }${suffix})`
}

/** `'/foo/'` is a string, and a CSS selector can never look like that. */
const LOOKS_LIKE_REGEXP = /^\/(.+)\/([gimsuy]*)$/

export function toDescriptor(t: Target): Descriptor {
  if (typeof t === 'string') {
    const asRegexp = LOOKS_LIKE_REGEXP.exec(t)
    if (asRegexp) {
      throw new Error(
        `"${t}" is a string, so it is used as a CSS selector. ` +
          `Drop the quotes to match by text instead: ${t}`
      )
    }
    return { kind: 'css', literal: t }
  }
  if (t instanceof RegExp) return { kind: 'text', source: t.source, flags: t.flags }

  const options: Record<string, unknown> = {}
  const regexpOptions: Record<string, { source: string; flags: string }> = {}
  for (const [key, value] of Object.entries(t.options ?? {})) {
    if (value instanceof RegExp) regexpOptions[key] = { source: value.source, flags: value.flags }
    else options[key] = value
  }

  return { kind: t.kind, ...matcherParts(t.matcher), options, regexpOptions }
}

/** A CSS selector takes the first match; everything else is meant to be unique. */
export const expectsOne = (t: Target): boolean => typeof t !== 'string'

const tag = (kind: string) =>
  (matcher: string | RegExp, options?: Record<string, unknown>): Tagged => ({
    __poke: 'target',
    kind,
    matcher,
    options,
  })

export const by = {
  byText: tag('text'),
  byRole: tag('role'),
  byLabel: tag('label'),
  byPlaceholder: tag('placeholder'),
  byTestId: tag('testId'),
  byAlt: tag('alt'),
  byTitle: tag('title'),
  byDisplayValue: tag('displayValue'),
}

export { isTagged }
