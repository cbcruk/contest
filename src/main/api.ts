import type { WebContents } from 'electron'
import { createExpect } from './expect'
import type { LogLine } from '../shared/types'

export type Emit = (line: LogLine) => void

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * The API injected into a buffer. It is built around two things a DevTools
 * snippet cannot do: input that the page sees as a real user (`sendInputEvent`),
 * and code that keeps running after the page navigates.
 */
export function createApi(getWc: () => WebContents, emit: Emit) {
  const wc = getWc
  const js = <T>(expr: string): Promise<T> => wc().executeJavaScript(expr, true) as Promise<T>

  // Navigation bookkeeping. A click often finishes navigating before the user's
  // next line runs, so waitForNavigation() must be able to see a load that
  // already happened since the last action instead of hanging for another one.
  let navSeq = 0
  let actionSeq = 0
  const markAction = (): void => { actionSeq = navSeq }
  const onDidFinishLoad = (): void => { navSeq += 1 }

  async function boxOf(selector: string): Promise<{ x: number; y: number } | null> {
    return js(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return null
      el.scrollIntoView({ block: 'center', inline: 'center' })
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return null
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })()`)
  }

  async function waitFor(selector: string, timeout = 5000): Promise<true> {
    const started = Date.now()
    for (;;) {
      if (await js<boolean>(`!!document.querySelector(${JSON.stringify(selector)})`)) return true
      if (Date.now() - started > timeout) throw new Error(`waitFor timeout: ${selector}`)
      await sleep(100)
    }
  }

  async function click(selector: string): Promise<void> {
    await waitFor(selector)
    markAction()
    const b = await boxOf(selector)
    if (!b) throw new Error(`click: not visible: ${selector}`)
    const at = { x: Math.round(b.x), y: Math.round(b.y) }
    wc().sendInputEvent({ type: 'mouseMove', ...at })
    wc().sendInputEvent({ type: 'mouseDown', ...at, button: 'left', clickCount: 1 })
    wc().sendInputEvent({ type: 'mouseUp', ...at, button: 'left', clickCount: 1 })
    await sleep(60)
  }

  async function type(selector: string, value: unknown): Promise<void> {
    await click(selector)
    for (const ch of String(value)) {
      wc().sendInputEvent({ type: 'char', keyCode: ch })
      await sleep(12)
    }
  }

  async function press(key: string): Promise<void> {
    markAction()
    wc().sendInputEvent({ type: 'keyDown', keyCode: key })
    wc().sendInputEvent({ type: 'keyUp', keyCode: key })
    await sleep(60)
  }

  function waitForNavigation(timeout = 15000): Promise<void> {
    // Already navigated since the last action: settle instead of hanging.
    if (navSeq > actionSeq) { actionSeq = navSeq; return sleep(120) }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error('waitForNavigation timeout'))
      }, timeout)
      const done = (): void => { cleanup(); actionSeq = navSeq; setTimeout(resolve, 120) }
      const cleanup = (): void => { clearTimeout(timer); wc().off('did-finish-load', done) }
      wc().on('did-finish-load', done)
    })
  }

  async function goto(target: string): Promise<void> {
    markAction()
    await wc().loadURL(target)
    actionSeq = navSeq
    await sleep(80)
  }

  const log = (...args: unknown[]): void =>
    emit({
      kind: 'info',
      message: args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
    })

  const api = {
    goto,
    click,
    type,
    press,
    waitFor,
    waitForNavigation,
    text: (sel: string) =>
      js<string | null>(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent?.trim() ?? null`),
    texts: (sel: string) =>
      js<string[]>(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e => e.textContent.trim())`),
    count: (sel: string) => js<number>(`document.querySelectorAll(${JSON.stringify(sel)}).length`),
    attr: (sel: string, name: string) =>
      js<string | null>(
        `(document.querySelector(${JSON.stringify(sel)})||{}).getAttribute?.(${JSON.stringify(name)}) ?? null`
      ),
    url: async () => wc().getURL(),
    title: async () => wc().getTitle(),
    evaluate: <T>(expr: string | (() => T)) =>
      js<T>(typeof expr === 'function' ? `(${expr})()` : expr),
    sleep,
    log,
    expect: createExpect(emit),
  }

  return { api, onDidFinishLoad }
}

export type PokeApi = ReturnType<typeof createApi>['api']
