import { addTest, createSuite, finalizeSuite } from './results'

let pendingTests: Promise<void>[] = []

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
export function describe(name: string, fn: () => void | Promise<void>): Promise<void> {
  createSuite(name)
  pendingTests = []

  const result = fn()

  const finalize = async (): Promise<void> => {
    if (result instanceof Promise) {
      await result
    }
    await Promise.all(pendingTests)
    finalizeSuite()
    pendingTests = []
  }

  return finalize()
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
  const runTest = async (): Promise<void> => {
    try {
      await fn()
      addTest({ name, passed: true })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      addTest({ name, passed: false, error })
    }
  }

  const testPromise = runTest()
  pendingTests.push(testPromise)
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
  }
}
