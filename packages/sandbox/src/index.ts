import { transform } from 'sucrase'

/**
 * Options for code execution.
 */
export interface ExecuteOptions {
  /**
   * Maximum execution time in milliseconds.
   * @default 5000
   */
  timeout?: number
  /**
   * Setup function to run before code execution.
   * Useful for initializing state or importing dependencies.
   */
  setup?: () => void | Promise<void>
  /**
   * Enable TypeScript/JSX transpilation using Sucrase.
   * When true, code is transformed before execution.
   * @default false
   */
  typescript?: boolean
}

/**
 * Result of code execution.
 * @template T - Type of the returned data
 */
export interface ExecuteResult<T = unknown> {
  /** Whether the execution completed without errors */
  success: boolean
  /** Return value from the executed code (if successful) */
  data?: T
  /** Error message (if execution failed) */
  error?: string
}

/**
 * Executes arbitrary JavaScript/TypeScript code in the current page context.
 * Uses AsyncFunction constructor for dynamic code execution with async/await support.
 *
 * @template T - Expected return type of the executed code
 * @param code - JavaScript or TypeScript code string to execute
 * @param options - Execution options (timeout, setup, typescript)
 * @returns Promise resolving to execution result with success status and data or error
 *
 * @example
 * ```typescript
 * // Simple JavaScript execution
 * const result = await execute('return 1 + 1')
 * // { success: true, data: 2 }
 *
 * // TypeScript execution
 * const result = await execute(
 *   'const x: number = 42; return x',
 *   { typescript: true }
 * )
 * // { success: true, data: 42 }
 *
 * // With setup function
 * const result = await execute('return document.title', {
 *   setup: () => console.log('Starting...')
 * })
 *
 * // With timeout
 * const result = await execute('while(true) {}', { timeout: 1000 })
 * // { success: false, error: 'Execution timeout' }
 * ```
 *
 * @remarks
 * - Code runs in the same context as the current page (has access to DOM, window, etc.)
 * - No sandbox isolation - use only with trusted code
 * - Supports async/await in the executed code
 * - When `typescript: true`, code is transpiled using Sucrase before execution
 */
export async function execute<T = unknown>(
  code: string,
  options: ExecuteOptions = {}
): Promise<ExecuteResult<T>> {
  const { timeout = 5000, setup, typescript = false } = options

  try {
    if (setup) {
      await setup()
    }

    let executableCode = code
    if (typescript) {
      const transformed = transform(code, {
        transforms: ['typescript', 'imports'],
      })
      executableCode = transformed.code
    }

    const AsyncFunction = Object.getPrototypeOf(
      async function () {}
    ).constructor
    const fn = new AsyncFunction(executableCode) as () => Promise<T>

    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), timeout)
      ),
    ])

    return { success: true, data: result }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { success: false, error }
  }
}

/**
 * Alias for {@link execute}.
 * Executes arbitrary JavaScript/TypeScript code in the current page context.
 *
 * @template T - Expected return type of the executed code
 * @param code - JavaScript or TypeScript code string to execute
 * @param options - Execution options (timeout, setup, typescript)
 * @returns Promise resolving to execution result
 *
 * @example
 * ```typescript
 * const result = await run<number>('return 42')
 * if (result.success) {
 *   console.log(result.data) // 42
 * }
 * ```
 */
export function run<T = unknown>(
  code: string,
  options: ExecuteOptions = {}
): Promise<ExecuteResult<T>> {
  return execute<T>(code, options)
}
