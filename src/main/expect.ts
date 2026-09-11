import {
  chai,
  JestAsymmetricMatchers,
  JestChaiExpect,
  JestExtend,
  setState,
} from '@vitest/expect'
import { diff } from '@vitest/utils/diff'
import { format, plugins } from '@vitest/pretty-format'
import type { ExpectStatic } from '@vitest/expect'
import type { LogLine } from '../shared/types'

// Vitest's matchers run fine without a runner: three chai plugins and one
// setState call. Hand-rolling this was how the old JSON-comparing toEqual got
// Set members, sparse arrays, key order and undefined properties wrong.
chai.use(JestExtend)
chai.use(JestChaiExpect)
chai.use(JestAsymmetricMatchers)

const chaiExpect = chai.expect as unknown as ExpectStatic

// The state is keyed on the expect function itself. Passing the exported
// GLOBAL_EXPECT symbol throws, since the store is a WeakMap.
setState({ assertionCalls: 0, isExpectingAssertions: false, soft: false }, chaiExpect)

/** Asymmetric matchers hang off `expect` and must survive the wrapper. */
const ASYMMETRIC = [
  'any',
  'anything',
  'arrayContaining',
  'objectContaining',
  'stringContaining',
  'stringMatching',
  'closeTo',
  'not',
] as const

/** tinyrainbow colours the diff regardless of options; the log panel is HTML. */
// eslint-disable-next-line no-control-regex
const ANSI = /\[[0-9;]*m/g
const stripAnsi = (s: string): string => s.replace(ANSI, '')

const label = (v: unknown): string =>
  format(v, { plugins: Object.values(plugins), printBasicPrototype: false, min: true })

type Emit = (line: LogLine) => void

interface ChaiError extends Error {
  actual?: unknown
  expected?: unknown
  showDiff?: boolean
}

/**
 * Builds the `expect` injected into a buffer. There is no describe/it: every
 * matcher call prints a line, and a failure prints a diff and stops the run.
 */
export function createExpect(emit: Emit) {
  const wrapped = (actual: unknown): unknown =>
    new Proxy(chaiExpect(actual), {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)
        if (typeof value !== 'function' || typeof prop !== 'string') return value

        return (...args: unknown[]): unknown => {
          const name = `${prop}${args.length ? ` ${args.map(label).join(', ')}` : ''}`
          try {
            const out = (value as (...a: unknown[]) => unknown).apply(target, args)
            emit({ kind: 'ok', message: `  ✓ ${name}` })
            return out
          } catch (err) {
            emit({ kind: 'error', message: `  ✗ ${name}` })
            const e = err as ChaiError
            if (e.showDiff) {
              const text = diff(e.expected, e.actual)
              if (text) emit({ kind: 'dim', message: stripAnsi(text) })
            }
            throw err
          }
        }
      },
    })

  for (const key of ASYMMETRIC) {
    Object.defineProperty(wrapped, key, {
      value: (chaiExpect as unknown as Record<string, unknown>)[key],
      enumerable: true,
    })
  }

  return wrapped
}
