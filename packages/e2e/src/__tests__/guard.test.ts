import { test, expect, vi } from 'vitest'
import type { Page, ElementHandle } from '../connect'
import { guardPage, isMutationAllowed, hostOf } from '../guard'

function fakePage(url: string): Page {
  const handle: ElementHandle = {
    click: vi.fn(async () => {}),
    type: vi.fn(async () => {}),
  }
  return {
    url: () => url,
    title: vi.fn(async () => 'title'),
    content: vi.fn(async () => '<html></html>'),
    goto: vi.fn(async () => ({})),
    close: vi.fn(async () => {}),
    click: vi.fn(async () => {}),
    type: vi.fn(async () => {}),
    $eval: vi.fn(async () => 'x' as never),
    $$eval: vi.fn(async () => [] as never),
    $: vi.fn(async () => handle),
    $$: vi.fn(async () => [handle]),
    waitForSelector: vi.fn(async () => handle),
    screenshot: vi.fn(async () => new Uint8Array()),
  }
}

test('hostOf extracts hostname, falls back to raw string', () => {
  expect(hostOf('https://example.com/path')).toBe('example.com')
  expect(hostOf('http://localhost:3000')).toBe('localhost')
  expect(hostOf('not a url')).toBe('not a url')
})

test('isMutationAllowed permits local dev hosts only by default', () => {
  expect(isMutationAllowed('http://localhost:3000')).toBe(true)
  expect(isMutationAllowed('http://127.0.0.1:8080')).toBe(true)
  expect(isMutationAllowed('http://app.test/page')).toBe(true)
  expect(isMutationAllowed('file:///tmp/index.html')).toBe(true)
  expect(isMutationAllowed('https://example.com')).toBe(false)
  expect(isMutationAllowed('https://app.prod.io')).toBe(false)
  expect(isMutationAllowed('about:blank')).toBe(false)
})

test('isMutationAllowed honors a custom allowlist', () => {
  expect(isMutationAllowed('https://staging.acme.com', ['staging.acme.com'])).toBe(
    true
  )
  expect(isMutationAllowed('https://staging.acme.com', [/\.acme\.com$/])).toBe(
    true
  )
  expect(isMutationAllowed('https://example.com', ['staging.acme.com'])).toBe(
    false
  )
})

test('read-only page passes observation through', async () => {
  const page = guardPage(fakePage('https://example.com'))
  expect(await page.title()).toBe('title')
  expect(page.url()).toBe('https://example.com')
  await expect(page.$('h1')).resolves.toBeTruthy()
})

test('read-only page refuses mutations', async () => {
  const page = guardPage(fakePage('http://localhost:3000'))
  await expect(page.click('button')).rejects.toThrow(/read-only/)
  await expect(page.type('input', 'x')).rejects.toThrow(/read-only/)
  await expect(page.goto('http://localhost:3000/next')).rejects.toThrow(
    /read-only/
  )
  await expect(page.close()).rejects.toThrow(/read-only/)
})

test('read-only guard extends to returned element handles', async () => {
  const page = guardPage(fakePage('http://localhost:3000'))
  const el = await page.$('button')
  await expect(el!.click()).rejects.toThrow(/read-only/)
  await expect(el!.type('x')).rejects.toThrow(/read-only/)
})

test('mutate:true allows interaction on local hosts', async () => {
  const page = guardPage(fakePage('http://localhost:3000'), { mutate: true })
  await expect(page.click('button')).resolves.toBeUndefined()
  await expect(page.type('input', 'x')).resolves.toBeUndefined()
})

test('mutate:true still refuses production-looking origins', async () => {
  const page = guardPage(fakePage('https://example.com'), { mutate: true })
  await expect(page.click('button')).rejects.toThrow(/not on the mutation allowlist/)
})

test('goto is checked against the target origin, not the current one', async () => {
  const page = guardPage(fakePage('http://localhost:3000'), { mutate: true })
  // Current origin is allowed, but navigating to production is refused.
  await expect(page.goto('https://example.com')).rejects.toThrow(
    /not on the mutation allowlist/
  )
})

test('allowMutationOn widens the policy', async () => {
  const page = guardPage(fakePage('https://staging.acme.com'), {
    mutate: true,
    allowMutationOn: [/\.acme\.com$/],
  })
  await expect(page.click('button')).resolves.toBeUndefined()
})
