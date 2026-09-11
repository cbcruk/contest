import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const ROOT = process.cwd(); const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, 'test/fixtures', path.basename(req.url.split('?')[0]))
  if (fs.existsSync(f)) { res.writeHead(200, {'Content-Type':'text/html'}); res.end(fs.readFileSync(f)) } else { res.writeHead(404); res.end('x') }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const site = `http://127.0.0.1:${server.address().port}`
const udd = fs.mkdtempSync('/tmp/poke-t-')
const proc = spawn('xvfb-run', ['-a','-s','-screen 0 1440x900x24', ROOT+'/node_modules/.bin/electron', ROOT,
  '--remote-debugging-port=9860','--no-sandbox',`--user-data-dir=${udd}`], { cwd: ROOT, stdio:'ignore', detached: true })
let browser
for (let i=0;i<50;i++){ try { browser = await puppeteer.connect({browserURL:'http://127.0.0.1:9860'}); break } catch { await wait(500) } }
const panel = (await browser.pages()).find(p=>p.url().includes('index.html'))
for (let i=0;i<40;i++){ if (await panel.evaluate(()=>Boolean(window.__pokeTest))) break; await wait(250) }
const run = async (code) => {
  await panel.evaluate((c)=>{ document.getElementById('log').textContent=''; window.__pokeTest.setCode(c) }, code)
  await panel.evaluate(()=>window.__pokeTest.run())
  for (let i=0;i<60;i++){ const l=await panel.evaluate(()=>window.__pokeTest.log()); if(/done \(|error:|line \d+:/.test(l)) break; await wait(200) }
  return panel.evaluate(()=>window.__pokeTest.log())
}
console.log('=== 중복 매치 ===')
console.log(await run(`await goto('${site}/rooms.html')\nawait text(/중복/)`))
console.log('\n=== 없는 텍스트 ===')
console.log(await run(`await text(/없는텍스트/, 400)`))
console.log('\n=== evaluate 안에서 던지기 ===')
console.log(await run(`await evaluate('nope.nope')`))
console.log('\n=== evaluate 정상 ===')
console.log(await run(`log(await evaluate('[...document.querySelectorAll(".card")].length'))`))
try { process.kill(-proc.pid,'SIGKILL') } catch {}
server.close(); fs.rmSync(udd,{recursive:true,force:true}); process.exit(0)
