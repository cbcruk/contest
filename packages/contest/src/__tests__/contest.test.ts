import { test, expect as vitestExpect, beforeEach } from 'vitest'
import {
  describe as contestDescribe,
  it as contestIt,
  expect as contestExpect,
  getResults,
  clearResults,
} from '../index'

beforeEach(() => {
  clearResults()
})

test('describe creates a suite with the given name', () => {
  contestDescribe('My Suite', () => {})

  const results = getResults()
  vitestExpect(results).toHaveLength(1)
  vitestExpect(results[0].name).toBe('My Suite')
})

test('it creates a test inside describe', () => {
  contestDescribe('Suite', () => {
    contestIt('test 1', () => {})
    contestIt('test 2', () => {})
  })

  const results = getResults()
  vitestExpect(results[0].tests).toHaveLength(2)
  vitestExpect(results[0].tests[0].name).toBe('test 1')
  vitestExpect(results[0].tests[1].name).toBe('test 2')
})

test('it throws when called outside describe', () => {
  vitestExpect(() => {
    contestIt('orphan test', () => {})
  }).toThrow('it() must be called inside describe()')
})

test('passing test is marked as passed', () => {
  contestDescribe('Suite', () => {
    contestIt('passes', () => {
      contestExpect(1).toBe(1)
    })
  })

  const results = getResults()
  vitestExpect(results[0].tests[0].passed).toBe(true)
  vitestExpect(results[0].tests[0].error).toBeUndefined()
})

test('failing test is marked as failed with error message', () => {
  contestDescribe('Suite', () => {
    contestIt('fails', () => {
      contestExpect(1).toBe(2)
    })
  })

  const results = getResults()
  vitestExpect(results[0].tests[0].passed).toBe(false)
  vitestExpect(results[0].tests[0].error).toContain('Expected 2')
})

test('expect.toBe compares with strict equality', () => {
  contestDescribe('toBe', () => {
    contestIt('same value passes', () => {
      contestExpect(42).toBe(42)
    })
    contestIt('different value fails', () => {
      contestExpect(1).toBe(2)
    })
    contestIt('same reference passes', () => {
      const obj = { a: 1 }
      contestExpect(obj).toBe(obj)
    })
    contestIt('different reference fails', () => {
      contestExpect({ a: 1 }).toBe({ a: 1 })
    })
  })

  const tests = getResults()[0].tests
  vitestExpect(tests[0].passed).toBe(true)
  vitestExpect(tests[1].passed).toBe(false)
  vitestExpect(tests[2].passed).toBe(true)
  vitestExpect(tests[3].passed).toBe(false)
})

test('expect.toEqual compares by value', () => {
  contestDescribe('toEqual', () => {
    contestIt('same object value passes', () => {
      contestExpect({ a: 1 }).toEqual({ a: 1 })
    })
    contestIt('different object value fails', () => {
      contestExpect({ a: 1 }).toEqual({ a: 2 })
    })
    contestIt('same array passes', () => {
      contestExpect([1, 2, 3]).toEqual([1, 2, 3])
    })
  })

  const tests = getResults()[0].tests
  vitestExpect(tests[0].passed).toBe(true)
  vitestExpect(tests[1].passed).toBe(false)
  vitestExpect(tests[2].passed).toBe(true)
})

test('clearResults resets all results', () => {
  contestDescribe('Suite 1', () => {
    contestIt('test', () => {})
  })
  vitestExpect(getResults()).toHaveLength(1)

  clearResults()
  vitestExpect(getResults()).toHaveLength(0)
})

test('multiple describes create multiple suites', () => {
  contestDescribe('Suite 1', () => {
    contestIt('test 1', () => {})
  })
  contestDescribe('Suite 2', () => {
    contestIt('test 2', () => {})
  })

  const results = getResults()
  vitestExpect(results).toHaveLength(2)
  vitestExpect(results[0].name).toBe('Suite 1')
  vitestExpect(results[1].name).toBe('Suite 2')
})
