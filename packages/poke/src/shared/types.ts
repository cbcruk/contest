/** One line in the run log shown under the editor. */
export interface LogLine {
  message: string
  kind: 'info' | 'ok' | 'error' | 'dim'
}

/** Outcome of running a buffer. `line` is 1-based in the user's own source. */
export interface RunResult {
  ok: boolean
  error?: string
  line?: number
  durationMs: number
}

export interface BufferMeta {
  id: string
  name: string
}

export interface PokeBridge {
  run(code: string): Promise<RunResult>
  goto(url: string): Promise<string>
  listBuffers(): Promise<BufferMeta[]>
  readBuffer(id: string): Promise<string>
  writeBuffer(id: string, code: string): Promise<void>
  createBuffer(name: string): Promise<BufferMeta>
  renameBuffer(id: string, name: string): Promise<void>
  deleteBuffer(id: string): Promise<void>
  shot(out: string): Promise<string>
  onLog(cb: (line: LogLine) => void): void
  onUrl(cb: (url: string) => void): void
}
