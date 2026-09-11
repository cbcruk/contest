/** A CSS selector, or a RegExp matched against an element's own text. */
export type Target = string | RegExp

/**
 * Evaluated in the page. The text branch is testing-library's `getNodeText`
 * trick: only an element's **direct** text children count. Without that,
 * `<div><span>3진료실</span></div>` matches the span, the div, the body and
 * every wrapper in between, and there is no way to say which one you meant.
 *
 * Whitespace is normalised the same way testing-library does, so markup
 * wrapped across lines still matches what the page visibly reads.
 */
const FIND_IN_PAGE = `(selector, source, flags) => {
  if (source === null) return [...document.querySelectorAll(selector)]
  const re = new RegExp(source, flags)
  return [...document.querySelectorAll('body *')].filter((el) => {
    if (el.matches('script, style, noscript')) return false
    const own = el.matches('input[type=submit], input[type=button], input[type=reset]')
      ? el.value
      : [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')
    const text = own.replace(/\\s+/g, ' ').trim()
    return text !== '' && re.test(text)
  })
}`

export const describeTarget = (t: Target): string =>
  typeof t === 'string' ? `"${t}"` : String(t)

/** JS expression evaluating to every element matching the target. */
export function findAll(t: Target): string {
  return typeof t === 'string'
    ? `(${FIND_IN_PAGE})(${JSON.stringify(t)}, null, '')`
    : `(${FIND_IN_PAGE})(null, ${JSON.stringify(t.source)}, ${JSON.stringify(t.flags)})`
}

/** JS expression evaluating to the first matching element, or undefined. */
export function findOne(t: Target): string {
  return `${findAll(t)}[0]`
}

/**
 * JS expression describing what a target matched. Ambiguity is reported from
 * the Node side: an Error thrown inside executeJavaScript arrives as
 * "Script failed to execute" with the message gone.
 */
export function describeMatches(t: Target): string {
  return `(() => {
    const els = ${findAll(t)}
    return {
      n: els.length,
      shown: els.slice(0, 4).map((e) =>
        e.tagName.toLowerCase() + ' "' +
        e.textContent.replace(/\\s+/g, ' ').trim().slice(0, 30) + '"'),
    }
  })()`
}
