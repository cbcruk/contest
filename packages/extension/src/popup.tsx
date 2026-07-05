import { render } from 'preact'
import { useState, useCallback, useEffect } from 'preact/hooks'
import './styles.css'
import {
  describe,
  it,
  expect,
  type TestResult,
  type SuiteResult,
  getResults,
  clearResults,
  setReporter,
} from '@contest/core'
import { withPage } from '@contest/e2e'

const STORAGE_KEY = 'contest:code'

/**
 * Seed shown on first open. `describe`, `it`, `expect`, `withPage` and `log`
 * are injected into the user's code, so it reads like a normal test file.
 * The page is read-only by default; pass `{ mutate: true }` to withPage to
 * interact (allowed on local-dev origins only).
 */
const DEFAULT_CODE = [
  "await describe('Page Content', () => {",
  "  it('has a title', withPage(async (page) => {",
  '    const title = await page.title()',
  "    log('Title: ' + title)",
  '    expect(title).toBeTruthy()',
  '  }))',
  '',
  "  it('has an h1', withPage(async (page) => {",
  "    const h1 = await page.$('h1')",
  '    expect(h1).toBeTruthy()',
  '  }))',
  '})',
].join('\n')

const AsyncFunction = Object.getPrototypeOf(
  async function () {}
).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<void>

interface LogEntry {
  message: string
  type: 'info' | 'error' | 'success'
  timestamp: string
}

interface AppState {
  suites: SuiteResult[]
  logs: LogEntry[]
  running: boolean
}

function App(): preact.JSX.Element {
  const [code, setCode] = useState<string>(DEFAULT_CODE)
  const [state, setState] = useState<AppState>({
    suites: [],
    logs: [
      {
        message: 'Ready. Edit the tests and click "Run".',
        type: 'info',
        timestamp: new Date().toLocaleTimeString(),
      },
    ],
    running: false,
  })

  // Restore the last-edited test source across popup opens.
  useEffect(() => {
    chrome.storage?.local.get(STORAGE_KEY).then((stored) => {
      const saved = stored?.[STORAGE_KEY]
      if (typeof saved === 'string' && saved.length > 0) {
        setCode(saved)
      }
    })
  }, [])

  const onCodeInput = useCallback((e: Event) => {
    const value = (e.target as HTMLTextAreaElement).value
    setCode(value)
    chrome.storage?.local.set({ [STORAGE_KEY]: value })
  }, [])

  const log = useCallback(
    (message: string, type: LogEntry['type'] = 'info') => {
      setState((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          { message, type, timestamp: new Date().toLocaleTimeString() },
        ],
      }))
    },
    []
  )

  const runTests = useCallback(async () => {
    setState((prev) => ({ ...prev, running: true, logs: [], suites: [] }))

    clearResults()

    // Stream each result to the UI log as the shared runner records it.
    setReporter((test: TestResult) => {
      const mark = test.skipped ? '○' : test.passed ? '✓' : '✗'
      log(
        `${mark} ${test.name}${test.error ? `: ${test.error}` : ''}`,
        test.skipped ? 'info' : test.passed ? 'success' : 'error'
      )
    })

    try {
      log('Running tests against the current tab...')

      // Evaluate the user's test source with the contest API in scope. This
      // runs in the popup and drives the page over CDP via withPage; it makes
      // no isolation claim about the page itself.
      const run = new AsyncFunction(
        'describe',
        'it',
        'expect',
        'withPage',
        'log',
        code
      )
      await run(describe, it, expect, withPage, log)

      const suites = getResults()
      const total = suites.flatMap((s: SuiteResult) => s.tests)
      const runnable = total.filter((t: TestResult) => !t.skipped)
      const passed = runnable.filter((t: TestResult) => t.passed).length
      const skipped = total.length - runnable.length

      log(
        `Completed: ${passed}/${runnable.length} passed` +
          (skipped ? `, ${skipped} skipped` : ''),
        passed === runnable.length ? 'success' : 'error'
      )

      setState((prev) => ({ ...prev, suites, running: false }))
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      log(`Error: ${error}`, 'error')
      setState((prev) => ({ ...prev, running: false }))
    } finally {
      setReporter(null)
    }
  }, [code, log])

  return (
    <div class="p-4">
      <h1 class="text-base font-semibold text-primary mb-3">Contest E2E</h1>

      <textarea
        class="w-full h-40 p-2 mb-3 bg-dark-log text-[12px] font-mono rounded border border-gray-700 resize-y focus:outline-none focus:border-primary"
        spellcheck={false}
        value={code}
        onInput={onCodeInput}
        disabled={state.running}
      />

      <div class="mb-3">
        {state.suites.length === 0 ? (
          <div class="text-gray-500 text-xs">Click "Run" to execute tests</div>
        ) : (
          state.suites.map((suite) => (
            <div class="mb-3" key={suite.name}>
              <div class="font-semibold mb-1.5 text-primary">{suite.name}</div>
              {suite.tests.map((test) => (
                <div
                  class="flex items-center p-2 bg-dark-card rounded mb-1.5"
                  key={test.name}
                >
                  <div
                    class={`w-2 h-2 rounded-full mr-2 ${
                      test.skipped
                        ? 'bg-gray-500'
                        : test.passed
                        ? 'bg-green-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <span class="flex-1 text-[13px]">{test.name}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <button
        class="w-full py-2.5 bg-primary text-dark-bg border-none rounded text-sm font-semibold cursor-pointer hover:bg-primary-hover disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
        onClick={runTests}
        disabled={state.running}
      >
        {state.running ? 'Running...' : 'Run Tests on Current Tab'}
      </button>

      <div class="mt-3 p-2 bg-dark-log rounded text-[11px] font-mono max-h-[150px] overflow-y-auto">
        {state.logs.map((entry, i) => (
          <div
            class={`mb-1 ${
              entry.type === 'error'
                ? 'text-red-500'
                : entry.type === 'success'
                ? 'text-green-500'
                : ''
            }`}
            key={i}
          >
            [{entry.timestamp}] {entry.message}
          </div>
        ))}
      </div>
    </div>
  )
}

render(<App />, document.getElementById('app')!)
