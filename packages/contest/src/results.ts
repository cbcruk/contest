/**
 * Result of a single test case.
 */
export interface TestResult {
  /** Name of the test case */
  name: string
  /** Whether the test passed */
  passed: boolean
  /** Error message if the test failed */
  error?: string
}

/**
 * Result of a test suite (describe block).
 */
export interface SuiteResult {
  /** Name of the test suite */
  name: string
  /** Array of test results within this suite */
  tests: TestResult[]
}

let currentSuite: SuiteResult | null = null
let results: SuiteResult[] = []

/**
 * Creates a new test suite. Called internally by `describe()`.
 *
 * @param name - Name of the test suite
 * @throws Error if called while another suite is active (nested describe blocks are not supported)
 * @internal
 */
export function createSuite(name: string): void {
  if (currentSuite) {
    throw new Error('Cannot nest describe blocks')
  }

  currentSuite = { name, tests: [] }
}

/**
 * Finalizes the current test suite and adds it to results.
 * Called internally by `describe()` after all tests have run.
 *
 * @internal
 */
export function finalizeSuite(): void {
  if (currentSuite) {
    results.push(currentSuite)
    currentSuite = null
  }
}

/**
 * Adds a test result to the current suite. Called internally by `it()`.
 *
 * @param test - The test result to add
 * @throws Error if called outside of a describe block
 * @internal
 */
export function addTest(test: TestResult): void {
  if (!currentSuite) {
    throw new Error('it() must be called inside describe()')
  }

  currentSuite.tests.push(test)
}

/**
 * Returns all collected test results.
 *
 * @returns Array of suite results containing all test outcomes
 *
 * @example
 * ```typescript
 * describe('Math', () => {
 *   it('adds numbers', () => {
 *     expect(1 + 1).toBe(2)
 *   })
 * })
 *
 * const results = getResults()
 * // [{ name: 'Math', tests: [{ name: 'adds numbers', passed: true }] }]
 * ```
 */
export function getResults(): SuiteResult[] {
  return results
}

/**
 * Clears all test results and resets internal state.
 * Call this before running a new set of tests.
 *
 * @example
 * ```typescript
 * clearResults()
 * // Run new tests...
 * describe('New Suite', () => { ... })
 * ```
 */
export function clearResults(): void {
  results = []
  currentSuite = null
}
