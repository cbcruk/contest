import { addTest, createSuite, finalizeSuite } from './results'

/**
 * Queue of registered-but-not-yet-run test thunks for the active suite.
 * Tests run **serially** (one awaited at a time), not concurrently: an
 * attach-based runner (puppeteer over CDP) cannot open concurrent sessions
 * against the same tab, so serial execution is the only safe model.
 */
let pendingTests: (() => Promise<void>)[] = []
/** True only while a `describe` callback is synchronously registering `it`s. */
let collecting = false

/**
 * Defines a test suite containing related test cases.
 * Supports both sync and async test functions.
 *
 * @param name - Name of the test suite
 * @param fn - Function containing test cases defined with `it()`
 * @returns Promise that resolves when all tests complete (for async tests)
 *
 * @example
 * ```typescript
 * // Sync tests
 * describe('Calculator', () => {
 *   it('adds two numbers', () => {
 *     expect(1 + 2).toBe(3)
 *   })
 * })
 *
 * // Async tests
 * await describe('API', () => {
 *   it('fetches data', async () => {
 *     const data = await fetchData()
 *     expect(data).toBeTruthy()
 *   })
 * })
 * ```
 */
export async function describe(
  name: string,
  fn: () => void | Promise<void>
): Promise<void> {
  createSuite(name)
  pendingTests = []

  collecting = true
  try {
    const result = fn()
    if (result instanceof Promise) {
      await result
    }
  } finally {
    collecting = false
  }

  for (const test of pendingTests) {
    await test()
  }

  finalizeSuite()
  pendingTests = []
}

/**
 * Defines a single test case within a test suite.
 * Must be called inside a `describe()` block.
 * Supports both sync and async test functions.
 *
 * @param name - Name describing what the test verifies
 * @param fn - Function containing assertions using `expect()`
 *
 * @example
 * ```typescript
 * // Sync test
 * it('should return true for valid input', () => {
 *   expect(isValid('test')).toBe(true)
 * })
 *
 * // Async test
 * it('should fetch data', async () => {
 *   const data = await fetchData()
 *   expect(data).toBeTruthy()
 * })
 * ```
 */
export function it(name: string, fn: () => void | Promise<void>): void {
  if (!collecting) {
    throw new Error('it() must be called inside describe()')
  }

  pendingTests.push(async () => {
    try {
      await fn()
      addTest({ name, passed: true })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      addTest({ name, passed: false, error })
    }
  })
}

/**
 * Creates an assertion object for testing values.
 *
 * @param actual - The value to test
 * @returns Object with assertion methods
 *
 * @example
 * ```typescript
 * expect(2 + 2).toBe(4)
 * expect({ a: 1 }).toEqual({ a: 1 })
 * expect(true).toBeTruthy()
 * expect(null).toBeNull()
 * ```
 */
export function expect<T>(actual: T): {
  /**
   * Asserts strict equality using `===`.
   * Use for primitives (numbers, strings, booleans).
   *
   * @param expected - The expected value
   * @throws Error if values are not strictly equal
   */
  toBe: (expected: T) => void
  /**
   * Asserts deep equality using JSON serialization.
   * Use for objects and arrays.
   *
   * @param expected - The expected value
   * @throws Error if serialized values don't match
   */
  toEqual: (expected: T) => void
  /**
   * Asserts the value is truthy (not false, 0, '', null, undefined, NaN).
   *
   * @throws Error if value is falsy
   */
  toBeTruthy: () => void
  /**
   * Asserts the value is falsy (false, 0, '', null, undefined, NaN).
   *
   * @throws Error if value is truthy
   */
  toBeFalsy: () => void
  /**
   * Asserts the value is exactly `null`.
   *
   * @throws Error if value is not null
   */
  toBeNull: () => void
  /**
   * Asserts the value is exactly `undefined`.
   *
   * @throws Error if value is not undefined
   */
  toBeUndefined: () => void
  /**
   * Asserts a string contains a substring, or an array contains an element
   * (via `===`).
   *
   * @param item - The substring or element expected to be present
   * @throws Error if not contained, or if `actual` is neither string nor array
   */
  toContain: (item: unknown) => void
  /**
   * Asserts the value has a numeric `length` equal to `expected`.
   * Works for strings, arrays, and any length-bearing object.
   *
   * @param expected - The expected length
   * @throws Error if the length differs or is not numeric
   */
  toHaveLength: (expected: number) => void
  /**
   * Asserts that calling `actual` (a function) throws. Optionally checks the
   * thrown error's message against a substring or RegExp.
   *
   * @param expected - Optional substring or RegExp the error message must match
   * @throws Error if the function does not throw, or the message doesn't match
   */
  toThrow: (expected?: string | RegExp) => void
} {
  return {
    toBe(expected: T): void {
      if (actual !== expected) {
        throw new Error(
          `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(
            actual
          )}`
        )
      }
    },
    toEqual(expected: T): void {
      const actualStr = JSON.stringify(actual)
      const expectedStr = JSON.stringify(expected)
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${expectedStr}, but got ${actualStr}`)
      }
    },
    toBeTruthy(): void {
      if (!actual) {
        throw new Error(`Expected truthy, but got ${JSON.stringify(actual)}`)
      }
    },
    toBeFalsy(): void {
      if (actual) {
        throw new Error(`Expected falsy, but got ${JSON.stringify(actual)}`)
      }
    },
    toBeNull(): void {
      if (actual !== null) {
        throw new Error(`Expected null, but got ${JSON.stringify(actual)}`)
      }
    },
    toBeUndefined(): void {
      if (actual !== undefined) {
        throw new Error(`Expected undefined, but got ${JSON.stringify(actual)}`)
      }
    },
    toContain(item: unknown): void {
      if (typeof actual === 'string') {
        if (!actual.includes(String(item))) {
          throw new Error(`Expected "${actual}" to contain "${item}"`)
        }
        return
      }
      if (Array.isArray(actual)) {
        if (!actual.includes(item)) {
          throw new Error(
            `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(
              item
            )}`
          )
        }
        return
      }
      throw new Error('toContain() expects a string or array')
    },
    toHaveLength(expected: number): void {
      const length = (actual as { length?: unknown } | null | undefined)?.length
      if (typeof length !== 'number') {
        throw new Error('toHaveLength() expects a value with a numeric length')
      }
      if (length !== expected) {
        throw new Error(`Expected length ${expected}, but got ${length}`)
      }
    },
    toThrow(expected?: string | RegExp): void {
      if (typeof actual !== 'function') {
        throw new Error('toThrow() expects a function')
      }
      let thrown: unknown
      let threw = false
      try {
        ;(actual as () => unknown)()
      } catch (e) {
        threw = true
        thrown = e
      }
      if (!threw) {
        throw new Error('Expected function to throw, but it did not')
      }
      if (expected !== undefined) {
        const message = thrown instanceof Error ? thrown.message : String(thrown)
        const matches =
          typeof expected === 'string'
            ? message.includes(expected)
            : expected.test(message)
        if (!matches) {
          throw new Error(
            `Expected error matching ${expected}, but got "${message}"`
          )
        }
      }
    },
  }
}
