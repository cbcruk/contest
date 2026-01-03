# contest

Browser-based test runner that runs tests in actual browsers, not Node.js + jsdom.

## Why?

Frontend tests should run where frontend code runs - in real browsers. This gives you:

- Real DOM APIs, not jsdom approximations
- Actual browser behavior (layout, events, timing)
- Test what users actually experience

## Packages

| Package            | Description                                 |
| ------------------ | ------------------------------------------- |
| `@contest/core`    | Test framework - `describe`, `it`, `expect` |
| `@contest/sandbox` | Code execution with TypeScript support      |

## Usage

### Basic Test

```typescript
import { describe, it, expect, getResults, clearResults } from '@contest/core'

describe('Calculator', () => {
  it('adds numbers', () => {
    expect(1 + 2).toBe(3)
  })

  it('compares objects', () => {
    expect({ a: 1 }).toEqual({ a: 1 })
  })
})

const results = getResults()
console.log(results)
// [{ name: 'Calculator', tests: [{ name: 'adds numbers', passed: true }, ...] }]
```

### Dynamic Code Execution

```typescript
import { execute } from '@contest/sandbox'

// Execute JavaScript
const result = await execute('return 1 + 1')
// { success: true, data: 2 }

// Execute TypeScript
const result = await execute('const x: number = 42; return x', {
  typescript: true,
})
// { success: true, data: 42 }

// With timeout
const result = await execute(code, { timeout: 1000 })
```

### DOM Testing

```typescript
describe('Button', () => {
  it('responds to click', () => {
    const btn = document.getElementById('my-button')
    btn.click()
    expect(btn.textContent).toBe('Clicked!')
  })
})
```

## API

### @contest/core

#### `describe(name, fn)`

Defines a test suite.

#### `it(name, fn)`

Defines a test case. Must be inside `describe()`.

#### `expect(value)`

Creates assertions:

- `.toBe(expected)` - Strict equality (`===`)
- `.toEqual(expected)` - Deep equality (JSON comparison)
- `.toBeTruthy()` - Truthy check
- `.toBeFalsy()` - Falsy check
- `.toBeNull()` - Null check
- `.toBeUndefined()` - Undefined check

#### `getResults()`

Returns all test results as `SuiteResult[]`.

#### `clearResults()`

Clears all results. Call before running new tests.

### @contest/sandbox

#### `execute(code, options?)`

Executes code and returns result.

Options:

- `timeout?: number` - Max execution time (default: 5000ms)
- `typescript?: boolean` - Enable TypeScript transpilation
- `setup?: () => void` - Setup function before execution

Returns:

```typescript
interface ExecuteResult<T> {
  success: boolean
  data?: T
  error?: string
}
```

## TODO

- [ ] Nested `describe` blocks
- [ ] Async test support (`async/await` in `it`)
- [ ] More matchers (`toThrow`, `toContain`, `toHaveLength`, etc.)
- [ ] `beforeEach` / `afterEach` hooks
- [ ] `it.skip` / `it.only`
- [ ] DevTools extension for better DX
- [ ] Test file auto-discovery
- [ ] Watch mode
- [ ] Custom reporters
