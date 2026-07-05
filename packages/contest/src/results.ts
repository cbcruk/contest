/**
 * Result of a single test case.
 */
export interface TestResult {
  /** Name of the test case */
  name: string
  /** Whether the test passed (skipped tests are not failures, so `true`) */
  passed: boolean
  /** Error message if the test failed */
  error?: string
  /** Whether the test was skipped (via `it.skip` or an active `it.only`) */
  skipped?: boolean
}

/**
 * Result of a test suite (describe block). Nested `describe`s are flattened
 * into separate suites whose names are joined with ` > `.
 */
export interface SuiteResult {
  /** Fully-qualified suite name, e.g. `Outer > Inner` */
  name: string
  /** Array of test results within this suite */
  tests: TestResult[]
}

/**
 * Callback invoked each time a test result is recorded.
 * Lets a UI (e.g. the extension popup) stream results as they complete
 * without re-implementing the runner.
 */
export type Reporter = (test: TestResult) => void

/**
 * Stack of open suites. Supports nested `describe` blocks: the top of the
 * stack is the suite that `addTest` writes to, and child suite names are
 * prefixed with their ancestors' names.
 */
let suiteStack: SuiteResult[] = []
let results: SuiteResult[] = []
let reporter: Reporter | null = null

/**
 * Registers a reporter that is notified for every recorded test result.
 * Pass `null` to unsubscribe.
 *
 * @param fn - Reporter callback, or null to clear
 *
 * @example
 * ```typescript
 * setReporter((test) => {
 *   console.log(test.passed ? '✓' : '✗', test.name)
 * })
 * ```
 */
export function setReporter(fn: Reporter | null): void {
  reporter = fn
}

/**
 * Opens a new test suite, nested under the currently-open suite (if any).
 * Its recorded name is prefixed with the parent's name (`Parent > Child`).
 * Called internally by the runner.
 *
 * @param name - Name of the test suite (unqualified)
 * @internal
 */
export function createSuite(name: string): void {
  const parent = suiteStack[suiteStack.length - 1]
  const fullName = parent ? `${parent.name} > ${name}` : name
  const suite: SuiteResult = { name: fullName, tests: [] }

  suiteStack.push(suite)
  results.push(suite)
}

/**
 * Closes the currently-open suite.
 * Called internally by the runner after its tests have run.
 *
 * @internal
 */
export function finalizeSuite(): void {
  suiteStack.pop()
}

/**
 * Adds a test result to the currently-open suite. Called internally by the
 * runner. Notifies the registered reporter, if any.
 *
 * @param test - The test result to add
 * @throws Error if called outside of a describe block
 * @internal
 */
export function addTest(test: TestResult): void {
  const current = suiteStack[suiteStack.length - 1]
  if (!current) {
    throw new Error('it() must be called inside describe()')
  }

  current.tests.push(test)
  reporter?.(test)
}

/**
 * Returns all collected test results.
 *
 * @returns Array of suite results containing all test outcomes
 *
 * @example
 * ```typescript
 * await describe('Math', () => {
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
 * await describe('New Suite', () => { ... })
 * ```
 */
export function clearResults(): void {
  results = []
  suiteStack = []
}
