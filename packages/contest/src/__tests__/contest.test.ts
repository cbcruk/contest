import { test, expect as vitestExpect, beforeEach } from 'vitest'
import {
  describe as contestDescribe,
  it as contestIt,
  expect as contestExpect,
  beforeEach as contestBeforeEach,
  afterEach as contestAfterEach,
  beforeAll as contestBeforeAll,
  afterAll as contestAfterAll,
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

test('expect.toContain checks strings and arrays', async () => {
  await contestDescribe('toContain', () => {
    contestIt('string contains substring', () => {
      contestExpect('hello world').toContain('world')
    })
    contestIt('string missing substring fails', () => {
      contestExpect('hello').toContain('bye')
    })
    contestIt('array contains element', () => {
      contestExpect([1, 2, 3]).toContain(2)
    })
    contestIt('array missing element fails', () => {
      contestExpect([1, 2, 3]).toContain(9)
    })
  })

  const tests = getResults()[0].tests
  vitestExpect(tests[0].passed).toBe(true)
  vitestExpect(tests[1].passed).toBe(false)
  vitestExpect(tests[2].passed).toBe(true)
  vitestExpect(tests[3].passed).toBe(false)
})

test('expect.toHaveLength checks length', async () => {
  await contestDescribe('toHaveLength', () => {
    contestIt('array length passes', () => {
      contestExpect([1, 2, 3]).toHaveLength(3)
    })
    contestIt('string length passes', () => {
      contestExpect('abcd').toHaveLength(4)
    })
    contestIt('wrong length fails', () => {
      contestExpect([1]).toHaveLength(2)
    })
  })

  const tests = getResults()[0].tests
  vitestExpect(tests[0].passed).toBe(true)
  vitestExpect(tests[1].passed).toBe(true)
  vitestExpect(tests[2].passed).toBe(false)
})

test('expect.toThrow asserts a function throws', async () => {
  await contestDescribe('toThrow', () => {
    contestIt('throwing function passes', () => {
      contestExpect(() => {
        throw new Error('boom')
      }).toThrow()
    })
    contestIt('non-throwing function fails', () => {
      contestExpect(() => 42).toThrow()
    })
    contestIt('message substring matches', () => {
      contestExpect(() => {
        throw new Error('network timeout')
      }).toThrow('timeout')
    })
    contestIt('message regexp matches', () => {
      contestExpect(() => {
        throw new Error('code 503')
      }).toThrow(/\d{3}/)
    })
    contestIt('wrong message fails', () => {
      contestExpect(() => {
        throw new Error('boom')
      }).toThrow('fizzle')
    })
  })

  const tests = getResults()[0].tests
  vitestExpect(tests[0].passed).toBe(true)
  vitestExpect(tests[1].passed).toBe(false)
  vitestExpect(tests[2].passed).toBe(true)
  vitestExpect(tests[3].passed).toBe(true)
  vitestExpect(tests[4].passed).toBe(false)
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

test('nested describe flattens to Parent > Child suites', async () => {
  await contestDescribe('Outer', () => {
    contestIt('outer test', () => {})
    contestDescribe('Inner', () => {
      contestIt('inner test', () => {})
    })
  })

  const results = getResults()
  const outer = results.find((s) => s.name === 'Outer')
  const inner = results.find((s) => s.name === 'Outer > Inner')
  vitestExpect(outer?.tests.map((t) => t.name)).toEqual(['outer test'])
  vitestExpect(inner?.tests.map((t) => t.name)).toEqual(['inner test'])
})

test('deeply nested describe joins all ancestor names', async () => {
  await contestDescribe('A', () => {
    contestDescribe('B', () => {
      contestDescribe('C', () => {
        contestIt('leaf', () => {})
      })
    })
  })

  const names = getResults().map((s) => s.name)
  vitestExpect(names).toContain('A > B > C')
})

test('it.skip records a skipped test without running it', async () => {
  let ran = false
  await contestDescribe('Skips', () => {
    contestIt.skip('skipped', () => {
      ran = true
    })
    contestIt('runs', () => {})
  })

  const tests = getResults()[0].tests
  vitestExpect(ran).toBe(false)
  vitestExpect(tests[0].skipped).toBe(true)
  vitestExpect(tests[0].passed).toBe(true)
  vitestExpect(tests[1].skipped).toBeUndefined()
})

test('it.only runs only focused tests across the whole tree', async () => {
  const ran: string[] = []
  await contestDescribe('Focus', () => {
    contestIt('normal', () => {
      ran.push('normal')
    })
    contestIt.only('focused', () => {
      ran.push('focused')
    })
    contestDescribe('nested', () => {
      contestIt('nested normal', () => {
        ran.push('nested normal')
      })
      contestIt.only('nested focused', () => {
        ran.push('nested focused')
      })
    })
  })

  vitestExpect(ran).toEqual(['focused', 'nested focused'])
  const recorded = getResults().flatMap((s) => s.tests.map((t) => t.name))
  vitestExpect(recorded).toEqual(['focused', 'nested focused'])
})

test('beforeEach and afterEach run around each test', async () => {
  const events: string[] = []

  await contestDescribe('Hooks', () => {
    contestBeforeEach(() => {
      events.push('before')
    })
    contestAfterEach(() => {
      events.push('after')
    })
    contestIt('test 1', () => {
      events.push('test 1')
    })
    contestIt('test 2', () => {
      events.push('test 2')
    })
  })

  vitestExpect(events).toEqual([
    'before',
    'test 1',
    'after',
    'before',
    'test 2',
    'after',
  ])
})

test('hooks nest: outer before → inner before → test → inner after → outer after', async () => {
  const events: string[] = []

  await contestDescribe('Outer', () => {
    contestBeforeEach(() => {
      events.push('outer before')
    })
    contestAfterEach(() => {
      events.push('outer after')
    })
    contestDescribe('Inner', () => {
      contestBeforeEach(() => {
        events.push('inner before')
      })
      contestAfterEach(() => {
        events.push('inner after')
      })
      contestIt('t', () => {
        events.push('test')
      })
    })
  })

  vitestExpect(events).toEqual([
    'outer before',
    'inner before',
    'test',
    'inner after',
    'outer after',
  ])
})

test('afterEach runs even when the test fails', async () => {
  let cleanedUp = false

  await contestDescribe('Cleanup', () => {
    contestAfterEach(() => {
      cleanedUp = true
    })
    contestIt('fails', () => {
      contestExpect(1).toBe(2)
    })
  })

  const test = getResults()[0].tests[0]
  vitestExpect(test.passed).toBe(false)
  vitestExpect(cleanedUp).toBe(true)
})

test('a throwing beforeEach fails the test and still runs afterEach', async () => {
  let cleanedUp = false
  let testRan = false

  await contestDescribe('SetupFails', () => {
    contestBeforeEach(() => {
      throw new Error('setup boom')
    })
    contestAfterEach(() => {
      cleanedUp = true
    })
    contestIt('never runs its body', () => {
      testRan = true
    })
  })

  const test = getResults()[0].tests[0]
  vitestExpect(test.passed).toBe(false)
  vitestExpect(test.error).toContain('setup boom')
  vitestExpect(testRan).toBe(false)
  vitestExpect(cleanedUp).toBe(true)
})

test('skipped tests do not run hooks', async () => {
  let hookRan = false

  await contestDescribe('SkipHooks', () => {
    contestBeforeEach(() => {
      hookRan = true
    })
    contestIt.skip('skipped', () => {})
  })

  vitestExpect(hookRan).toBe(false)
})

test('beforeEach throws when called outside describe', () => {
  vitestExpect(() => {
    contestBeforeEach(() => {})
  }).toThrow('beforeEach() must be called inside describe()')
})

test('beforeAll runs once before all tests, afterAll once after', async () => {
  const events: string[] = []

  await contestDescribe('AllHooks', () => {
    contestBeforeAll(() => {
      events.push('beforeAll')
    })
    contestAfterAll(() => {
      events.push('afterAll')
    })
    contestIt('t1', () => {
      events.push('t1')
    })
    contestIt('t2', () => {
      events.push('t2')
    })
  })

  vitestExpect(events).toEqual(['beforeAll', 't1', 't2', 'afterAll'])
})

test('a failing beforeAll fails every test but still runs afterAll', async () => {
  let afterAllRan = false
  const bodiesRan: string[] = []

  await contestDescribe('BeforeAllFails', () => {
    contestBeforeAll(() => {
      throw new Error('setup exploded')
    })
    contestAfterAll(() => {
      afterAllRan = true
    })
    contestIt('a', () => {
      bodiesRan.push('a')
    })
    contestIt('b', () => {
      bodiesRan.push('b')
    })
  })

  const tests = getResults()[0].tests
  vitestExpect(tests.map((t) => t.passed)).toEqual([false, false])
  vitestExpect(tests[0].error).toContain('setup exploded')
  vitestExpect(bodiesRan).toEqual([])
  vitestExpect(afterAllRan).toBe(true)
})

test('beforeAll does not run when every test is skipped', async () => {
  let beforeAllRan = false

  await contestDescribe('AllSkipped', () => {
    contestBeforeAll(() => {
      beforeAllRan = true
    })
    contestIt.skip('nope', () => {})
  })

  vitestExpect(beforeAllRan).toBe(false)
})

test('a failing afterAll surfaces as a synthetic result', async () => {
  await contestDescribe('AfterAllFails', () => {
    contestAfterAll(() => {
      throw new Error('teardown boom')
    })
    contestIt('ok', () => {})
  })

  const tests = getResults()[0].tests
  const synthetic = tests.find((t) => t.name.includes('afterAll'))
  vitestExpect(tests[0].passed).toBe(true)
  vitestExpect(synthetic?.passed).toBe(false)
  vitestExpect(synthetic?.error).toContain('teardown boom')
})

test('afterAll throws when called outside describe', () => {
  vitestExpect(() => {
    contestAfterAll(() => {})
  }).toThrow('afterAll() must be called inside describe()')
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
