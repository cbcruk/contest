import type { WebContents } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { Descriptor } from './targets'

/**
 * Element queries run in a CDP isolated world rather than in the page itself.
 * testing-library has to live in the DOM, and dropping 180kB plus a global
 * into someone's app to get it there is rude. An isolated world shares the DOM
 * and nothing else, so the app's own globals are untouched.
 */
export class World {
  private contextId: number | null = null
  private attached = false
  private readonly bundle: string

  constructor(private readonly getWc: () => WebContents) {
    this.bundle = fs.readFileSync(path.join(__dirname, '../page/queries.js'), 'utf8')
  }

  /** Drop the world so the next call rebuilds it. Navigation destroys it. */
  invalidate(): void {
    this.contextId = null
  }

  detach(): void {
    const wc = this.getWc()
    if (this.attached && wc.debugger.isAttached()) wc.debugger.detach()
    this.attached = false
    this.contextId = null
  }

  async call<T>(method: string, ...args: unknown[]): Promise<T> {
    const contextId = await this.ensure()
    const expression = `__poke.${method}(${args.map((a) => JSON.stringify(a)).join(', ')})`
    return this.evaluate<T>(expression, contextId)
  }

  /** Convenience for the common shape: one descriptor in, a value out. */
  query<T>(method: string, descriptor: Descriptor, ...rest: unknown[]): Promise<T> {
    return this.call<T>(method, descriptor, ...rest)
  }

  private async ensure(): Promise<number> {
    if (this.contextId !== null) {
      const alive = await this.evaluate<string>('typeof __poke', this.contextId).catch(() => null)
      if (alive === 'object') return this.contextId
    }

    const wc = this.getWc()
    if (!wc.debugger.isAttached()) wc.debugger.attach('1.3')
    this.attached = true
    await wc.debugger.sendCommand('Page.enable')

    const { frameTree } = (await wc.debugger.sendCommand('Page.getFrameTree')) as {
      frameTree: { frame: { id: string } }
    }
    const { executionContextId } = (await wc.debugger.sendCommand('Page.createIsolatedWorld', {
      frameId: frameTree.frame.id,
      worldName: 'poke',
    })) as { executionContextId: number }

    this.contextId = executionContextId
    await this.evaluate('void 0', executionContextId, this.bundle)
    return executionContextId
  }

  private async evaluate<T>(expression: string, contextId: number, prelude?: string): Promise<T> {
    const wc = this.getWc()
    const result = (await wc.debugger.sendCommand('Runtime.evaluate', {
      expression: prelude ? `${prelude};\n${expression}` : expression,
      contextId,
      returnByValue: true,
      awaitPromise: true,
    })) as {
      result: { value: T }
      exceptionDetails?: { text: string; exception?: { description?: string } }
    }

    if (result.exceptionDetails) {
      const { exception, text } = result.exceptionDetails
      // Strip the stack that V8 prepends to `description`.
      const message = (exception?.description ?? text).split('\n')[0]
      throw new Error(message)
    }
    return result.result.value
  }
}
