import { render } from 'preact'
import { useState, useCallback } from 'preact/hooks'
import {
  connect,
  ExtensionTransport,
} from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js'
import './styles.css'
import {
  expect,
  type TestResult,
  type SuiteResult,
  getResults,
  clearResults,
  createSuite,
  finalizeSuite,
  addTest,
} from '@contest/core'

let pendingTests: (() => Promise<void>)[] = []

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof connect>>['pages']>>[0]

function withPage(fn: (page: Page) => Promise<void>): () => Promise<void> {
  return async (): Promise<void> => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })

    if (!tab.id) throw new Error('No active tab')

    const transport = await ExtensionTransport.connectTab(tab.id)
    const browser = await connect({ transport })
    const [page] = await browser.pages()

    try {
      await fn(page)
    } finally {
      browser.disconnect()
    }
  }
}

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
  const [state, setState] = useState<AppState>({
    suites: [],
    logs: [
      {
        message: 'Ready. Click "Run Tests" to start.',
        type: 'info',
        timestamp: new Date().toLocaleTimeString(),
      },
    ],
    running: false,
  })

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

    const addTestWithUI = (test: TestResult): void => {
      addTest(test)

      log(
        `${test.passed ? '\u2713' : '\u2717'} ${test.name}${
          test.error ? `: ${test.error}` : ''
        }`,
        test.passed ? 'success' : 'error'
      )
    }

    const describe = async (
      name: string,
      fn: () => void | Promise<void>
    ): Promise<void> => {
      createSuite(name)
      pendingTests = []
      const result = fn()
      if (result instanceof Promise) await result
      for (const test of pendingTests) {
        await test()
      }
      finalizeSuite()
      pendingTests = []
    }

    const it = (name: string, fn: () => void | Promise<void>): void => {
      pendingTests.push(async () => {
        try {
          await fn()
          addTestWithUI({ name, passed: true })
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e)
          addTestWithUI({ name, passed: false, error })
        }
      })
    }

    try {
      log('Running tests with contest + withPage...')

      await describe('Page Content', () => {
        it(
          'has a title',
          withPage(async (page) => {
            const title = await page.title()
            log(`Title: "${title}"`)
            expect(title).toBeTruthy()
          })
        )

        it(
          'has h1 element',
          withPage(async (page) => {
            const h1 = await page.$('h1')
            expect(h1).toBeTruthy()
          })
        )

        it(
          'can extract text content',
          withPage(async (page) => {
            const body = await page.$eval('body', (el) =>
              el.textContent?.slice(0, 50)
            )
            log(`Body preview: "${body}..."`)
            expect(body).toBeTruthy()
          })
        )
      })

      const suites = getResults()
      const total = suites.flatMap((s: SuiteResult) => s.tests)
      const passed = total.filter((t: TestResult) => t.passed).length

      log(
        `Completed: ${passed}/${total.length} passed`,
        passed === total.length ? 'success' : 'error'
      )

      setState((prev) => ({ ...prev, suites, running: false }))
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      log(`Error: ${error}`, 'error')
      setState((prev) => ({ ...prev, running: false }))
    }
  }, [log])

  return (
    <div class="p-4">
      <h1 class="text-base font-semibold text-primary mb-3">Contest E2E</h1>

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
                      test.passed ? 'bg-green-500' : 'bg-red-500'
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
