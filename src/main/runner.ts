import type { RunResult } from '../shared/types'

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>

const ANON = /<anonymous>:(\d+):(\d+)/

/**
 * `new AsyncFunction(args, body)` wraps the body in a function declaration, so
 * stack line numbers are offset from the user's own source. The offset is 2 on
 * current V8 regardless of argument count, but it is measured once at startup
 * rather than hardcoded so an engine change cannot silently misreport lines.
 */
let cachedOffset: number | null = null

export function stackOffset(): number {
  if (cachedOffset !== null) return cachedOffset
  cachedOffset = 2
  try {
    // A body whose only statement sits on user-line 1. The sync `Function`
    // constructor produces the same two-line prefix as the async one, so it
    // can be probed without awaiting.
    new Function('throw new Error("probe")')()
  } catch (err) {
    const m = err instanceof Error && err.stack ? ANON.exec(err.stack) : null
    if (m) cachedOffset = Number(m[1]) - 1
  }
  return cachedOffset
}

/** Maps a thrown error back to a 1-based line in the user's buffer. */
export function lineOf(err: unknown): number | undefined {
  if (!(err instanceof Error) || !err.stack) return undefined
  const m = ANON.exec(err.stack)
  if (!m) return undefined
  const line = Number(m[1]) - stackOffset()
  return line > 0 ? line : undefined
}

export interface RunContext {
  [name: string]: unknown
}

/**
 * Runs a buffer in the main process. Full Node is in scope (`require` is
 * injected) because there is no MV3 content security policy here.
 */
export async function runBuffer(code: string, ctx: RunContext): Promise<RunResult> {
  const started = Date.now()
  const names = Object.keys(ctx)
  let fn: (...args: unknown[]) => Promise<unknown>

  try {
    fn = new AsyncFunction(...names, 'require', code)
  } catch (err) {
    // Syntax errors surface at construction; V8 does not give a usable frame.
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started,
    }
  }

  try {
    await fn(...names.map((n) => ctx[n]), require)
    return { ok: true, durationMs: Date.now() - started }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      line: lineOf(err),
      durationMs: Date.now() - started,
    }
  }
}
