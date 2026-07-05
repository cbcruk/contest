import { addTest, createSuite, finalizeSuite } from './results'

type TestFn = () => void | Promise<void>

interface ItNode {
  kind: 'it'
  name: string
  fn: TestFn
  skip: boolean
  only: boolean
}

interface DescribeNode {
  kind: 'describe'
  name: string
  children: Array<ItNode | DescribeNode>
  beforeEach: TestFn[]
  afterEach: TestFn[]
  beforeAll: TestFn[]
  afterAll: TestFn[]
}

/**
 * Stack of `describe` nodes currently being collected. The top is the parent
 * that `it`/`describe` registers into. Empty means we're at the top level,
 * outside any suite.
 */
let describeStack: DescribeNode[] = []

function currentParent(): DescribeNode | undefined {
  return describeStack[describeStack.length - 1]
}

function register(node: ItNode): void {
  const parent = currentParent()
  if (!parent) {
    throw new Error('it() must be called inside describe()')
  }
  parent.children.push(node)
}

function requireParent(hook: string): DescribeNode {
  const parent = currentParent()
  if (!parent) {
    throw new Error(`${hook}() must be called inside describe()`)
  }
  return parent
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Whether the subtree contains any `it.only` (at any depth). */
function hasOnly(node: DescribeNode): boolean {
  return node.children.some((child) =>
    child.kind === 'it' ? child.only : hasOnly(child)
  )
}

/** Whether the subtree has at least one test whose body will actually run. */
function willExecute(node: DescribeNode, onlyActive: boolean): boolean {
  return node.children.some((child) =>
    child.kind === 'it'
      ? (!onlyActive || child.only) && !child.skip
      : willExecute(child, onlyActive)
  )
}

async function runIt(
  node: ItNode,
  onlyActive: boolean,
  beforeEach: TestFn[],
  afterEach: TestFn[],
  blockedError: string | undefined
): Promise<void> {
  // When any `.only` exists in the tree, non-only tests are omitted entirely.
  if (onlyActive && !node.only) {
    return
  }
  // Skipped tests don't run, and neither do their hooks (matching Jest).
  if (node.skip) {
    addTest({ name: node.name, passed: true, skipped: true })
    return
  }
  // A failed beforeAll upstream fails every test in the block without running
  // its body or per-test hooks.
  if (blockedError !== undefined) {
    addTest({ name: node.name, passed: false, error: blockedError })
    return
  }

  let error: string | undefined
  try {
    for (const hook of beforeEach) {
      await hook()
    }
    await node.fn()
  } catch (e) {
    error = errMsg(e)
  }
  // afterEach always runs, even when a beforeEach or the test threw.
  for (const hook of afterEach) {
    try {
      await hook()
    } catch (e) {
      if (error === undefined) error = errMsg(e)
    }
  }

  if (error === undefined) {
    addTest({ name: node.name, passed: true })
  } else {
    addTest({ name: node.name, passed: false, error })
  }
}

async function runDescribe(
  node: DescribeNode,
  onlyActive: boolean,
  beforeEach: TestFn[],
  afterEach: TestFn[],
  blockedError: string | undefined
): Promise<void> {
  createSuite(node.name)
  // Hooks are inherited: beforeEach runs outermost→innermost, afterEach the
  // reverse. Accumulate as we descend.
  const before = [...beforeEach, ...node.beforeEach]
  const after = [...node.afterEach, ...afterEach]

  // beforeAll/afterAll run once, and only when this subtree actually executes
  // a test and isn't already blocked by an upstream beforeAll failure.
  const runAll = blockedError === undefined && willExecute(node, onlyActive)
  let localBlocked = blockedError
  if (runAll) {
    for (const hook of node.beforeAll) {
      try {
        await hook()
      } catch (e) {
        localBlocked = errMsg(e)
        break
      }
    }
  }

  // Tests run serially in registration order — an attach-based runner
  // (puppeteer over CDP) can't open concurrent sessions against one tab.
  for (const child of node.children) {
    if (child.kind === 'describe') {
      await runDescribe(child, onlyActive, before, after, localBlocked)
    } else {
      await runIt(child, onlyActive, before, after, localBlocked)
    }
  }

  if (runAll) {
    for (const hook of node.afterAll) {
      try {
        await hook()
      } catch (e) {
        // Surface an afterAll failure as a visible synthetic result rather
        // than swallowing it — there's no user test to attach it to.
        addTest({ name: `${node.name} afterAll`, passed: false, error: errMsg(e) })
      }
    }
  }
  finalizeSuite()
}

/**
 * Defines a test suite containing related test cases. May be nested inside
 * another `describe` (nested suites are flattened to `Parent > Child` names).
 *
 * A top-level `describe` collects its entire subtree (including nested
 * `describe`s) before running anything, so `it.only` can select across the
 * whole tree. Always `await` it — tests run serially and results are only
 * complete once the returned promise resolves.
 *
 * @param name - Name of the test suite
 * @param fn - Function containing test cases defined with `it()`
 * @returns Promise that resolves when all tests in the tree complete
 *
 * @example
 * ```typescript
 * await describe('Calculator', () => {
 *   it('adds two numbers', () => {
 *     expect(1 + 2).toBe(3)
 *   })
 *
 *   describe('errors', () => {
 *     it('throws on divide by zero', () => {
 *       expect(() => divide(1, 0)).toThrow()
 *     })
 *   })
 * })
 * ```
 */
export async function describe(name: string, fn: TestFn): Promise<void> {
  const node: DescribeNode = {
    kind: 'describe',
    name,
    children: [],
    beforeEach: [],
    afterEach: [],
    beforeAll: [],
    afterAll: [],
  }
  const parent = currentParent()
  if (parent) {
    parent.children.push(node)
  }

  // Collection phase: run the callback to register children (no test bodies).
  describeStack.push(node)
  try {
    const result = fn()
    if (result instanceof Promise) {
      await result
    }
  } finally {
    describeStack.pop()
  }

  // Only the top-level describe executes; nested ones are run by their parent.
  if (!parent) {
    await runDescribe(node, hasOnly(node), [], [], undefined)
  }
}

/**
 * Registers a function to run once before the first test in the current suite
 * (and its nested suites). If it throws, every test in the block fails with
 * that error and its body/per-test hooks don't run, but `afterAll` still runs.
 * Must be called inside a `describe()` block.
 *
 * @param fn - Setup function (sync or async)
 */
export function beforeAll(fn: TestFn): void {
  requireParent('beforeAll').beforeAll.push(fn)
}

/**
 * Registers a function to run once after the last test in the current suite
 * (and its nested suites). Runs even if tests failed. Must be called inside a
 * `describe()` block.
 *
 * @param fn - Teardown function (sync or async)
 */
export function afterAll(fn: TestFn): void {
  requireParent('afterAll').afterAll.push(fn)
}

/**
 * Registers a function to run before each test in the current suite and its
 * nested suites. Must be called inside a `describe()` block.
 *
 * @param fn - Setup function (sync or async)
 *
 * @example
 * ```typescript
 * await describe('Cart', () => {
 *   let cart
 *   beforeEach(() => { cart = new Cart() })
 *   it('starts empty', () => expect(cart.items).toHaveLength(0))
 * })
 * ```
 */
export function beforeEach(fn: TestFn): void {
  requireParent('beforeEach').beforeEach.push(fn)
}

/**
 * Registers a function to run after each test in the current suite and its
 * nested suites. Runs even if the test (or a `beforeEach`) throws. Must be
 * called inside a `describe()` block.
 *
 * @param fn - Teardown function (sync or async)
 */
export function afterEach(fn: TestFn): void {
  requireParent('afterEach').afterEach.push(fn)
}

/**
 * Defines a single test case within a test suite. Must be called inside a
 * `describe()` block (throws otherwise). Supports sync and async functions.
 *
 * - `it.skip(name, fn)` — record the test as skipped without running it.
 * - `it.only(name, fn)` — run only `.only` tests within the top-level suite.
 *
 * @param name - Name describing what the test verifies
 * @param fn - Function containing assertions using `expect()`
 *
 * @example
 * ```typescript
 * it('should return true for valid input', () => {
 *   expect(isValid('test')).toBe(true)
 * })
 *
 * it.skip('not ready yet', () => { ... })
 * it.only('focus on this one', () => { ... })
 * ```
 */
interface ItApi {
  (name: string, fn: TestFn): void
  skip(name: string, fn: TestFn): void
  only(name: string, fn: TestFn): void
}

const itBase = (name: string, fn: TestFn): void => {
  register({ kind: 'it', name, fn, skip: false, only: false })
}

export const it: ItApi = Object.assign(itBase, {
  skip(name: string, fn: TestFn): void {
    register({ kind: 'it', name, fn, skip: true, only: false })
  },
  only(name: string, fn: TestFn): void {
    register({ kind: 'it', name, fn, skip: false, only: true })
  },
})

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
