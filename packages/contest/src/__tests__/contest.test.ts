import { test, expect as vitestExpect, beforeEach } from 'vitest'
import {
  describe as contestDescribe,
  it as contestIt,
  expect as contestExpect,
  getResults,
  clearResults,
  setReporter,
} from '../index'

beforeEach(() => {
  clearResults()
})

test('describe creates a suite with the given name', async () => {
  await contestDescribe('My Suite', () => {})

  const results = getResults()
  vitestExpect(results).toHaveLength(1)
  vitestExpect(results[0].name).toBe('My Suite')
})

test('it creates a test inside describe', async () => {
  await contestDescribe('Suite', () => {
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

test('passing test is marked as passed', async () => {
  await contestDescribe('Suite', () => {
    contestIt('passes', () => {
      contestExpect(1).toBe(1)
    })
  })

  const results = getResults()
  vitestExpect(results[0].tests[0].passed).toBe(true)
  vitestExpect(results[0].tests[0].error).toBeUndefined()
})

test('failing test is marked as failed with error message', async () => {
  await contestDescribe('Suite', () => {
    contestIt('fails', () => {
      contestExpect(1).toBe(2)
    })
  })

  const results = getResults()
  vitestExpect(results[0].tests[0].passed).toBe(false)
  vitestExpect(results[0].tests[0].error).toContain('Expected 2')
})

test('async test is awaited before the suite finalizes', async () => {
  await contestDescribe('Async', () => {
    contestIt('resolves', async () => {
      await Promise.resolve()
      contestExpect(1).toBe(1)
    })
  })

  const results = getResults()
  vitestExpect(results[0].tests).toHaveLength(1)
  vitestExpect(results[0].tests[0].passed).toBe(true)
})

test('tests run serially in registration order', async () => {
  const order: number[] = []

  await contestDescribe('Serial', () => {
    contestIt('first', async () => {
      await Promise.resolve()
      order.push(1)
    })
    contestIt('second', async () => {
      order.push(2)
    })
  })

  vitestExpect(order).toEqual([1, 2])
})

test('expect.toBe compares with strict equality', async () => {
  await contestDescribe('toBe', () => {
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

test('expect.toEqual compares by value', async () => {
  await contestDescribe('toEqual', () => {
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

test('setReporter streams each result as it is recorded', async () => {
  const seen: string[] = []
  setReporter((t) => seen.push(t.name))

  await contestDescribe('Reported', () => {
    contestIt('a', () => {})
    contestIt('b', () => {})
  })

  setReporter(null)
  vitestExpect(seen).toEqual(['a', 'b'])
})

test('clearResults resets all results', async () => {
  await contestDescribe('Suite 1', () => {
    contestIt('test', () => {})
  })
  vitestExpect(getResults()).toHaveLength(1)

  clearResults()
  vitestExpect(getResults()).toHaveLength(0)
})

test('multiple describes create multiple suites', async () => {
  await contestDescribe('Suite 1', () => {
    contestIt('test 1', () => {})
  })
  await contestDescribe('Suite 2', () => {
    contestIt('test 2', () => {})
  })

  const results = getResults()
  vitestExpect(results).toHaveLength(2)
  vitestExpect(results[0].name).toBe('Suite 1')
  vitestExpect(results[1].name).toBe('Suite 2')
})
