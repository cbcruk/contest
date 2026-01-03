const DEFAULT_DEBUG_PORT = 9222

export interface ConnectOptions {
  browserWSEndpoint?: string
  debugPort?: number
}

interface VersionResponse {
  webSocketDebuggerUrl: string
  Browser: string
  'Protocol-Version': string
  'User-Agent': string
  'V8-Version': string
  'WebKit-Version': string
}

export interface Browser {
  newPage(): Promise<Page>
  pages(): Promise<Page[]>
  disconnect(): Promise<void>
  close(): Promise<void>
}

export interface Page {
  goto(url: string): Promise<unknown>
  title(): Promise<string>
  url(): string
  content(): Promise<string>
  close(): Promise<void>
  $eval<T>(selector: string, fn: (el: Element) => T): Promise<T>
  $$eval<T>(selector: string, fn: (els: Element[]) => T): Promise<T>
  $(selector: string): Promise<ElementHandle | null>
  $$(selector: string): Promise<ElementHandle[]>
  click(selector: string): Promise<void>
  type(selector: string, text: string): Promise<void>
  waitForSelector(selector: string): Promise<ElementHandle | null>
  screenshot(options?: {
    path?: string
    fullPage?: boolean
  }): Promise<Uint8Array>
}

export interface ElementHandle {
  click(): Promise<void>
  type(text: string): Promise<void>
}

export async function getEndpoint(
  port: number = DEFAULT_DEBUG_PORT
): Promise<string> {
  const res = await fetch(`http://localhost:${port}/json/version`)

  if (!res.ok) {
    throw new Error(
      `Failed to get browser endpoint. Is Chrome running with --remote-debugging-port=${port}?`
    )
  }

  const data: VersionResponse = await res.json()

  return data.webSocketDebuggerUrl
}

export async function connect(options: ConnectOptions = {}): Promise<Browser> {
  let { browserWSEndpoint, debugPort = DEFAULT_DEBUG_PORT } = options

  if (!browserWSEndpoint) {
    browserWSEndpoint = await getEndpoint(debugPort)
  }

  const { connect: puppeteerConnect } = await import(
    /* @vite-ignore */
    'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js'
  )

  const browser = await puppeteerConnect({ browserWSEndpoint })

  return browser as Browser
}
