// Launches poke under Xvfb and drives its own UI over CDP.
// Verifies the two things a DevTools snippet cannot do, plus the editor loop.
import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const PORT_CDP = 9600
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const check = (name, actual, expected) => {
  const ok = String(actual) === String(expected)
  results.push({ name, ok, actual, expected })
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  (기대 ${expected}, 실제 ${actual})`}`)
}

const server = http.createServer((req, res) => {
  const file = path.join(HERE, 'fixtures', path.basename(req.url.split('?')[0]))
  if (fs.existsSync(file)) {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(fs.readFileSync(file))
  } else { res.writeHead(404); res.end('x') }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const site = `http://127.0.0.1:${server.address().port}`

const userData = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'poke-smoke-'))
const proc = spawn('xvfb-run', ['-a', '-s', '-screen 0 1440x900x24',
  path.join(ROOT, 'node_modules/.bin/electron'), ROOT,
  `--remote-debugging-port=${PORT_CDP}`, '--no-sandbox', `--user-data-dir=${userData}`,
], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
proc.stderr.on('data', (d) => { const s = String(d); if (/Error/.test(s)) process.stderr.write('[electron] ' + s.slice(0, 300)) })

const bail = (msg) => { console.error('FAIL:', msg); shutdown(); process.exit(1) }
function shutdown() {
  try { process.kill(-proc.pid, 'SIGKILL') } catch {}
  server.close()
  fs.rmSync(userData, { recursive: true, force: true })
}

let browser
for (let i = 0; i < 50; i++) {
  try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT_CDP}` }); break }
  catch { await wait(500) }
}
if (!browser) bail('electron never exposed CDP')

let panel = null
for (let i = 0; i < 40; i++) {
  panel = (await browser.pages()).find((p) => p.url().includes('index.html'))
  if (panel) break
  await wait(500)
}
if (!panel) bail('control panel not found')
for (let i = 0; i < 40; i++) {
  if (await panel.evaluate(() => Boolean(window.__pokeTest))) break
  await wait(250)
}

const runCode = async (code) => {
  await panel.evaluate((c) => window.__pokeTest.setCode(c), code)
  await panel.evaluate(() => window.__pokeTest.run())
  for (let i = 0; i < 80; i++) {
    const log = await panel.evaluate(() => window.__pokeTest.log())
    if (/done \(|error:|line \d+:/.test(log)) return log
    await wait(250)
  }
  return await panel.evaluate(() => window.__pokeTest.log())
}

// ---- 1. 신뢰된 입력과 내비게이션 생존 ----
const log1 = await runCode(`
await goto('${site}/page1.html')
log('T:' + await title())
await click('#probe')
log('TRUSTED:' + String(await evaluate('window.__trusted')))
await click('#link')
await waitForNavigation()
log('URL:' + await url())
log('H1:' + await text('h1'))
await type('#name', 'poked')
log('INPUT:' + await evaluate('document.querySelector("#name").value'))
expect(await text('h1')).toEqual('Page Two')
`)
check('제목 읽기', /T:Page One/.test(log1), true)
check('신뢰된 입력 (isTrusted)', /TRUSTED:true/.test(log1), true)
check('내비게이션 생존', /URL:.*page2\.html/.test(log1), true)
check('이동 후 DOM 읽기', /H1:Page Two/.test(log1), true)
check('신뢰된 키 입력', /INPUT:poked/.test(log1), true)
check('단언 통과 표시', /✓ toEqual/.test(log1), true)
check('실행 성공 보고', /done \(/.test(log1), true)

// 로그 채널과 실행 결과가 경쟁해 마지막 단언이 done 뒤로 밀린 적이 있다.
const lines1 = log1.split('\n').map((l) => l.trim()).filter(Boolean)
check('done 이 로그의 마지막 줄', /^done \(/.test(lines1[lines1.length - 1] ?? ''), true)

// ---- 2. 에러 줄 번호 ----
// throw 는 아래 배열의 4번째 줄에 있다.
const errCode = ['const a = 1', 'const b = 2', '', "throw new Error('boom')"].join('\n')
const log2 = await runCode(errCode)
const reported = /line (\d+): boom/.exec(log2)
check('에러 줄 번호', reported ? reported[1] : `없음 (${log2.replace(/\n/g, ' | ')})`, 4)
check('에디터 에러 줄 표시', await panel.evaluate(() => window.__pokeTest.errorLines()), 1)

// API 내부에서 던져도 사용자 줄을 가리키는가
const log3 = await runCode(`await goto('${site}/page1.html')
await waitFor('#nope', 300)
`)
check('API 실패도 사용자 줄로', /line 2: waitFor timeout/.test(log3), true)

// ---- 3. 버퍼 전환 ----
const a = await panel.evaluate(() => window.poke.createBuffer('alpha'))
await panel.evaluate((id) => window.__pokeTest.openBuffer(id), a.id)
await panel.evaluate(() => window.__pokeTest.setCode('// ALPHA\n'))
await wait(400)
const b = await panel.evaluate(() => window.poke.createBuffer('beta'))
await panel.evaluate((id) => window.__pokeTest.openBuffer(id), b.id)
await panel.evaluate(() => window.__pokeTest.setCode('// BETA\n'))
await wait(400)
await panel.evaluate((id) => window.__pokeTest.openBuffer(id), a.id)
await wait(400)
check('버퍼 전환 후 내용 유지', (await panel.evaluate(() => window.__pokeTest.getCode())).trim(), '// ALPHA')
check('활성 버퍼 추적', await panel.evaluate(() => window.__pokeTest.activeTab()), a.id)

shutdown()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 통과`)
process.exit(failed.length ? 1 : 0)
