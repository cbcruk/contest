import type { LogLine } from '../shared/types'

/**
 * Recursive structural equality. contest compared JSON strings, which gets
 * key order, `undefined` properties, NaN, Date, Map and Set all wrong.
 */
export function deepEqual(a: unknown, b: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false

  // Cycles: if we're already comparing this pair, assume equal and let the
  // rest of the structure decide.
  const prior = seen.get(a)
  if (prior === b) return true
  seen.set(a, b)

  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false
  if (a instanceof Date) return a.getTime() === (b as Date).getTime()
  if (a instanceof RegExp) return a.source === (b as RegExp).source && a.flags === (b as RegExp).flags

  if (a instanceof Map) {
    const bm = b as Map<unknown, unknown>
    if (a.size !== bm.size) return false
    for (const [k, v] of a) {
      if (!bm.has(k) || !deepEqual(v, bm.get(k), seen)) return false
    }
    return true
  }

  if (a instanceof Set) {
    const bs = b as Set<unknown>
    if (a.size !== bs.size) return false
    for (const v of a) if (!bs.has(v)) return false
    return true
  }

  if (Array.isArray(a)) {
    const ba = b as unknown[]
    if (a.length !== ba.length) return false
    return a.every((v, i) => deepEqual(v, ba[i], seen))
  }

  // Plain objects: compare own keys, `undefined` values included.
  const ka = Reflect.ownKeys(a)
  const kb = Reflect.ownKeys(b)
  if (ka.length !== kb.length) return false
  return ka.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(b, k) &&
      deepEqual((a as Record<PropertyKey, unknown>)[k], (b as Record<PropertyKey, unknown>)[k], seen)
  )
}

const show = (v: unknown): string => {
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'bigint') return `${v}n`
  if (v instanceof Date) return v.toISOString()
  if (v instanceof Map) return `Map(${v.size})`
  if (v instanceof Set) return `Set(${v.size})`
  if (typeof v === 'object' && v !== null) {
    try { return JSON.stringify(v) } catch { return String(v) }
  }
  return String(v)
}

type Emit = (line: LogLine) => void

/**
 * Assertions for a buffer. There is no describe/it: each check just prints a
 * line and throws on failure, which stops the run at that point.
 */
export function expect(actual: unknown, emit: Emit) {
  const pass = (what: string): void => emit({ kind: 'ok', message: `  ✓ ${what}` })
  const fail = (what: string, detail: string): never => {
    emit({ kind: 'error', message: `  ✗ ${what}` })
    throw new Error(detail)
  }

  return {
    toBe(other: unknown): void {
      if (Object.is(actual, other)) return pass(`toBe ${show(other)}`)
      fail(`toBe ${show(other)}`, `expected ${show(other)}, got ${show(actual)}`)
    },
    toEqual(other: unknown): void {
      if (deepEqual(actual, other)) return pass(`toEqual ${show(other)}`)
      fail(`toEqual ${show(other)}`, `expected ${show(other)}, got ${show(actual)}`)
    },
    toContain(item: unknown): void {
      const what = `toContain ${show(item)}`
      if (typeof actual === 'string') {
        if (actual.includes(String(item))) return pass(what)
        return fail(what, `${show(actual)} does not contain ${show(item)}`)
      }
      if (Array.isArray(actual)) {
        if (actual.some((v) => deepEqual(v, item))) return pass(what)
        return fail(what, `${show(actual)} does not contain ${show(item)}`)
      }
      return fail(what, 'toContain expects a string or array')
    },
    toHaveLength(n: number): void {
      const len = (actual as { length?: unknown } | null | undefined)?.length
      const what = `toHaveLength ${n}`
      if (typeof len !== 'number') return fail(what, 'value has no numeric length')
      if (len === n) return pass(what)
      return fail(what, `expected length ${n}, got ${len}`)
    },
    toBeTruthy(): void {
      if (actual) return pass('toBeTruthy')
      fail('toBeTruthy', `expected truthy, got ${show(actual)}`)
    },
    toBeFalsy(): void {
      if (!actual) return pass('toBeFalsy')
      fail('toBeFalsy', `expected falsy, got ${show(actual)}`)
    },
    toBeNull(): void {
      if (actual === null) return pass('toBeNull')
      fail('toBeNull', `expected null, got ${show(actual)}`)
    },
    toThrow(expected?: string | RegExp): void {
      const what = expected === undefined ? 'toThrow' : `toThrow ${show(expected)}`
      if (typeof actual !== 'function') return fail(what, 'toThrow expects a function')
      let thrown: unknown
      let threw = false
      try { (actual as () => unknown)() } catch (e) { threw = true; thrown = e }
      if (!threw) return fail(what, 'function did not throw')
      if (expected === undefined) return pass(what)
      const message = thrown instanceof Error ? thrown.message : String(thrown)
      const ok = typeof expected === 'string' ? message.includes(expected) : expected.test(message)
      if (ok) return pass(what)
      return fail(what, `expected error matching ${show(expected)}, got ${show(message)}`)
    },
  }
}
