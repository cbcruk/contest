import fs from 'node:fs'
import path from 'node:path'
import type { BufferMeta } from '../shared/types'

const SEED = `// poke — 지금 보고 있는 화면 그대로에 코드를 쏜다.
// goto 를 지우면 현재 페이지에 그대로 이어붙는다.

await goto('http://localhost:3000')
log('제목:', await title())

expect(await text('h1')).toBeTruthy()
`

/** Buffers are plain .js files so they can be opened in any editor. */
export class Buffers {
  constructor(private readonly dir: string) {
    fs.mkdirSync(dir, { recursive: true })
    if (this.list().length === 0) this.create('scratch', SEED)
  }

  private file(id: string): string {
    // Ids come from our own listing, but never let one escape the directory.
    const safe = path.basename(id)
    return path.join(this.dir, `${safe}.js`)
  }

  list(): BufferMeta[] {
    return fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith('.js'))
      .map((f) => f.slice(0, -3))
      .sort()
      .map((id) => ({ id, name: id }))
  }

  read(id: string): string {
    const f = this.file(id)
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''
  }

  write(id: string, code: string): void {
    fs.writeFileSync(this.file(id), code, 'utf8')
  }

  create(name: string, code = '// \n'): BufferMeta {
    const id = this.unique(name)
    this.write(id, code)
    return { id, name: id }
  }

  rename(id: string, name: string): void {
    const next = this.unique(name)
    fs.renameSync(this.file(id), this.file(next))
  }

  delete(id: string): void {
    const f = this.file(id)
    if (fs.existsSync(f)) fs.unlinkSync(f)
    if (this.list().length === 0) this.create('scratch', SEED)
  }

  private unique(name: string): string {
    const base = name.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'buffer'
    if (!fs.existsSync(this.file(base))) return base
    for (let i = 2; ; i += 1) {
      const candidate = `${base}-${i}`
      if (!fs.existsSync(this.file(candidate))) return candidate
    }
  }
}
