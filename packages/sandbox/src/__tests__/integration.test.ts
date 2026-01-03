import { describe, it, expect, beforeAll } from 'vitest'
import { execute } from '../index'
import {
  describe as contestDescribe,
  it as contestIt,
  expect as contestExpect,
  getResults,
  clearResults,
  type SuiteResult,
} from '@contest/core'

declare global {
  interface Window {
    describe: typeof contestDescribe
    it: typeof contestIt
    expect: typeof contestExpect
    getResults: typeof getResults
    clearResults: typeof clearResults
  }
}

beforeAll(() => {
  window.describe = contestDescribe
  window.it = contestIt
  window.expect = contestExpect
  window.getResults = getResults
  window.clearResults = clearResults
})

describe('contest integration', () => {
  it('runs tests and collects results', async () => {
    clearResults()

    const testCode = `
      describe('Math', () => {
        it('adds numbers', () => {
          expect(1 + 1).toBe(2)
        })
      })
      return getResults()
    `

    const result = await execute(testCode, { typescript: true })
    expect(result.success).toBe(true)
    expect(result.data).toEqual([
      {
        name: 'Math',
        tests: [{ name: 'adds numbers', passed: true }],
      },
    ])
  })

  it('captures test failures', async () => {
    clearResults()

    const testCode = `
      describe('Failing', () => {
        it('should fail', () => {
          expect(1).toBe(2)
        })
      })
      return getResults()
    `

    const result = await execute<SuiteResult[]>(testCode, { typescript: true })
    expect(result.success).toBe(true)
    expect(result.data?.[0].tests[0].passed).toBe(false)
    expect(result.data?.[0].tests[0].error).toContain('Expected 2')
  })

  it('accesses DOM elements', async () => {
    const div = document.createElement('div')
    div.id = 'integration-test-element'
    div.textContent = 'Hello'
    document.body.appendChild(div)

    clearResults()

    const testCode = `
      describe('DOM', () => {
        it('finds element', () => {
          const el = document.getElementById('integration-test-element')
          expect(el).toBeTruthy()
          expect(el.textContent).toBe('Hello')
        })
      })
      return getResults()
    `

    const result = await execute<SuiteResult[]>(testCode, { typescript: true })
    expect(result.success).toBe(true)
    expect(result.data?.[0].tests[0].passed).toBe(true)

    document.body.removeChild(div)
  })

  it('runs multiple test suites', async () => {
    clearResults()

    const testCode = `
      describe('Suite A', () => {
        it('test 1', () => expect(true).toBeTruthy())
        it('test 2', () => expect(false).toBeFalsy())
      })
      describe('Suite B', () => {
        it('test 3', () => expect(1).toBe(1))
      })
      return getResults()
    `

    const result = await execute<SuiteResult[]>(testCode, { typescript: true })
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.data?.[0].name).toBe('Suite A')
    expect(result.data?.[0].tests).toHaveLength(2)
    expect(result.data?.[1].name).toBe('Suite B')
    expect(result.data?.[1].tests).toHaveLength(1)
  })
})
