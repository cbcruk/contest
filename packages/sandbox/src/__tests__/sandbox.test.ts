import { describe, it, expect } from 'vitest'
import { execute, run } from '../index'

describe('execute', () => {
  describe('basic execution', () => {
    it('executes simple JavaScript and returns result', async () => {
      const result = await execute('return 1 + 1')
      expect(result.success).toBe(true)
      expect(result.data).toBe(2)
    })

    it('executes code without return statement', async () => {
      const result = await execute('const x = 1')
      expect(result.success).toBe(true)
      expect(result.data).toBeUndefined()
    })

    it('handles async code', async () => {
      const result = await execute(
        'return await Promise.resolve(42)'
      )
      expect(result.success).toBe(true)
      expect(result.data).toBe(42)
    })
  })

  describe('typescript option', () => {
    it('transpiles TypeScript when enabled', async () => {
      const result = await execute(
        'const x: number = 42; return x',
        { typescript: true }
      )
      expect(result.success).toBe(true)
      expect(result.data).toBe(42)
    })

    it('transpiles interface and type annotations', async () => {
      const code = `
        interface User { name: string; age: number }
        const user: User = { name: 'John', age: 30 }
        return user.name
      `
      const result = await execute(code, { typescript: true })
      expect(result.success).toBe(true)
      expect(result.data).toBe('John')
    })

    it('does not transpile when disabled (default)', async () => {
      const result = await execute('return 1 + 1')
      expect(result.success).toBe(true)
      expect(result.data).toBe(2)
    })
  })

  describe('error handling', () => {
    it('catches thrown errors', async () => {
      const result = await execute('throw new Error("test error")')
      expect(result.success).toBe(false)
      expect(result.error).toBe('test error')
    })

    it('catches non-Error throws', async () => {
      const result = await execute('throw "string error"')
      expect(result.success).toBe(false)
      expect(result.error).toBe('string error')
    })

    it('catches syntax errors in TypeScript', async () => {
      const result = await execute('const x: = 1', { typescript: true })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('timeout option', () => {
    it('times out long-running async code', async () => {
      const result = await execute(
        'await new Promise(resolve => setTimeout(resolve, 5000))',
        { timeout: 100 }
      )
      expect(result.success).toBe(false)
      expect(result.error).toBe('Execution timeout')
    })

    it('completes before timeout', async () => {
      const result = await execute(
        'await new Promise(resolve => setTimeout(resolve, 10)); return "done"',
        { timeout: 1000 }
      )
      expect(result.success).toBe(true)
      expect(result.data).toBe('done')
    })

    it('uses default timeout of 5000ms', async () => {
      const start = Date.now()
      const result = await execute(
        'await new Promise(resolve => setTimeout(resolve, 100)); return true'
      )
      const elapsed = Date.now() - start
      expect(result.success).toBe(true)
      expect(elapsed).toBeLessThan(5000)
    })
  })

  describe('setup option', () => {
    it('runs setup function before execution', async () => {
      let setupCalled = false
      const result = await execute('return true', {
        setup: () => {
          setupCalled = true
        },
      })
      expect(setupCalled).toBe(true)
      expect(result.success).toBe(true)
    })

    it('supports async setup function', async () => {
      let setupComplete = false
      const result = await execute('return true', {
        setup: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          setupComplete = true
        },
      })
      expect(setupComplete).toBe(true)
      expect(result.success).toBe(true)
    })

    it('catches errors in setup function', async () => {
      const result = await execute('return true', {
        setup: () => {
          throw new Error('setup failed')
        },
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('setup failed')
    })
  })

  describe('DOM access', () => {
    it('can access document', async () => {
      const result = await execute('return typeof document')
      expect(result.success).toBe(true)
      expect(result.data).toBe('object')
    })

    it('can access window', async () => {
      const result = await execute('return typeof window')
      expect(result.success).toBe(true)
      expect(result.data).toBe('object')
    })

    it('can manipulate DOM elements', async () => {
      const div = document.createElement('div')
      div.id = 'test-sandbox-element'
      document.body.appendChild(div)

      const result = await execute(`
        const el = document.getElementById('test-sandbox-element')
        el.textContent = 'modified'
        return el.textContent
      `)

      expect(result.success).toBe(true)
      expect(result.data).toBe('modified')

      document.body.removeChild(div)
    })
  })
})

describe('run', () => {
  it('is an alias for execute', async () => {
    const result = await run('return 42')
    expect(result.success).toBe(true)
    expect(result.data).toBe(42)
  })

  it('accepts same options as execute', async () => {
    const result = await run('const x: number = 1; return x', {
      typescript: true,
      timeout: 1000,
    })
    expect(result.success).toBe(true)
    expect(result.data).toBe(1)
  })
})
