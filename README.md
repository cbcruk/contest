# contest

Assert against the browser tab you're **already looking at** — no fresh browser
launch, no Node + jsdom.

Contest is a Chrome extension that attaches to your current, live tab over the
Chrome DevTools Protocol (via `puppeteer-core`) and runs `describe`/`it`/`expect`
tests against it — with your real session, cookies, and page state intact.

## Why?

Frontend tests should run where frontend code runs — in real browsers, against
the real page:

- Real DOM APIs, not jsdom approximations
- Actual browser behavior (layout, events, timing)
- The **live** page as it actually is (logged in, mid-flow), not a fresh context

Most browser-automation tools launch a new, empty browser. Contest instead
attaches to the tab in front of you. See [`docs/direction.md`](docs/direction.md)
for the reasoning and roadmap.

> ⚠️ **Read-only by default.** Attaching to a live tab means interactions
> (`click`, `type`, navigation, closing) mutate real application state —
> possibly against a production backend. So `withPage` gives you a **read-only**
> page: those methods throw unless you opt in with `{ mutate: true }`, and even
> then only on allowlisted (local-dev) origins. Observation
> (`title`, `$eval`, computed style, visibility) is always allowed.

## Packages

| Package             | Description                                              |
| ------------------- | ------------------------------------------------------- |
| `@contest/core`     | Test framework — `describe`, `it`, `expect`, results    |
| `@contest/e2e`      | Attach to a live tab (`connect`, `withPage`) over CDP   |
| `@contest/extension`| Chrome extension: run tests against the current tab     |

## Usage

### Writing tests

`@contest/core` is the single runner. Tests run **serially** in registration
order (an attach session can't run concurrently against one tab), so always
`await` a suite before reading its results.

```typescript
import { describe, it, expect, getResults, clearResults } from '@contest/core'

clearResults()

await describe('Calculator', () => {
  it('adds numbers', () => {
    expect(1 + 2).toBe(3)
  })

  it('compares objects', () => {
    expect({ a: 1 }).toEqual({ a: 1 })
  })
})

console.log(getResults())
// [{ name: 'Calculator', tests: [{ name: 'adds numbers', passed: true }, ...] }]
```

### Attaching to the live tab

`@contest/e2e` gives each test a `Page` bound to your current tab over CDP:

```typescript
import { describe, it, expect } from '@contest/core'
import { withPage } from '@contest/e2e'

await describe('Page', () => {
  // Read-only: observe the live tab.
  it('has a title', withPage(async (page) => {
    const title = await page.title()
    expect(title).toBeTruthy()
  }))

  // Opt into interaction — allowed only on local-dev origins by default.
  it('submits the form', withPage(async (page) => {
    await page.type('#email', 'a@b.co')
    await page.click('#submit')
  }, { mutate: true }))
})
```

### Streaming results to a UI

Register a reporter to receive each result as it is recorded (used by the
extension popup):

```typescript
import { setReporter, describe, it } from '@contest/core'

setReporter((test) => {
  console.log(test.passed ? '✓' : '✗', test.name)
})
```

## API

### @contest/core

#### `describe(name, fn): Promise<void>`

Defines a test suite. Always `await` it — tests run serially and results are
only complete once the returned promise resolves.

#### `it(name, fn)`

Defines a test case. Must be called synchronously inside a `describe()` callback;
throws otherwise. `fn` may be sync or async.

- `it.skip(name, fn)` — record the test as skipped without running it.
- `it.only(name, fn)` — run only `.only` tests within that top-level suite.

`describe` blocks may be nested; nested suites are reported as `Parent > Child`.

#### `expect(value)`

Creates assertions:

- `.toBe(expected)` — strict equality (`===`)
- `.toEqual(expected)` — deep equality (JSON comparison)
- `.toBeTruthy()` / `.toBeFalsy()`
- `.toBeNull()` / `.toBeUndefined()`
- `.toContain(item)` — substring (strings) or element (arrays)
- `.toHaveLength(n)` — numeric `length` check
- `.toThrow(expected?)` — asserts a function throws; optional message
  substring / RegExp

#### `getResults()` / `clearResults()`

Read all collected `SuiteResult[]`, or reset before a new run.

#### `setReporter(fn | null)`

Subscribe to per-test results as they are recorded; pass `null` to unsubscribe.

### @contest/e2e

#### `connect(options?)`

Connects to a browser over CDP and returns a puppeteer `Browser`.

#### `withPage(fn, options?)`

Wraps an async test body so it receives a `Page` attached to the active tab.
Use inside `it()`. The page is **read-only** unless `options.mutate` is true.

Options:

- `url?` / `newTab?` — navigate to a URL, optionally in a new tab
- `mutate?: boolean` — enable `click` / `type` / `goto` / `close` (default `false`)
- `allowMutationOn?: (string | RegExp)[]` — origins where mutation is permitted
  (default: local-dev hosts only)

#### `guardPage(page, options?)`

Wraps a `Page` to enforce the read-only/mutation policy directly. `withPage`
uses it internally.

## TODO

- [x] Read-only default + explicit mutation opt-in with an origin guard
- [x] Reconcile `docs/extension-design.md` with the shipped popup design
- [x] Remove `@contest/sandbox`
- [x] More matchers (`toThrow`, `toContain`, `toHaveLength`)
- [x] Nested `describe` blocks
- [x] `it.skip` / `it.only`
- [x] Unify the popup's inline `withPage` with `@contest/e2e`
- [x] User-authored tests in the popup (editable, persisted via `chrome.storage`)
- [ ] `beforeEach` / `afterEach` hooks
- [ ] Bundle-size reduction (popup bundles puppeteer-core)
- [ ] Test file auto-discovery, watch mode, custom reporters
