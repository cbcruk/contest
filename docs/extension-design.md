# Contest Extension Design

> Status: Implemented (`packages/extension`)
>
> 이 문서는 이전의 "DevTools Sources 사이드바 + `inspectedWindow.eval`" 초안을
> 대체한다. 그 방식은 puppeteer-over-CDP 부착이 상위호환하므로 폐기됐다.
> (배경: [`direction.md`](./direction.md))

## Overview

Manifest V3 팝업 익스텐션. 버튼을 누르면 **현재 활성 탭**에 CDP로 부착해
`@contest/core`의 `describe`/`it`/`expect` 테스트를 돌리고 결과를 팝업에 표시한다.

핵심 가치: 새 브라우저를 띄우지 않고 **지금 로그인된 채 보고 있는 그 탭**에
그대로 붙는다. 통상의 puppeteer/playwright가 빈 컨텍스트를 새로 여는 것과 반대.

## Structure

```
packages/extension/
├── public/
│   ├── manifest.json     # MV3, debugger 권한, 팝업
│   └── popup.html
├── src/
│   ├── popup.tsx         # Preact UI + 러너 구동
│   ├── background.ts     # service worker (현재 최소)
│   └── styles.css        # Tailwind
├── stubs/                # 브라우저 번들용 Node 모듈 스텁 (ws, chromium-bidi, @puppeteer/browsers)
└── vite.config.ts        # popup.js + background.js 빌드
```

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "Contest Puppeteer",
  "permissions": ["debugger", "activeTab", "scripting", "tabs"],
  "host_permissions": ["<all_urls>"],
  "action": { "default_popup": "popup.html" },
  "background": { "service_worker": "background.js", "type": "module" }
}
```

`debugger` 권한이 CDP 부착의 핵심이다. puppeteer-core는 `ExtensionTransport`를
통해 이 권한 위에서 동작한다.

## Attach flow

```ts
import { connect, ExtensionTransport } from 'puppeteer-core/.../puppeteer-core-browser.js'
import { guardPage, type Page } from '@contest/e2e'

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
const transport = await ExtensionTransport.connectTab(tab.id!)
const browser = await connect({ transport })
const [rawPage] = await browser.pages()
const page = guardPage(rawPage as unknown as Page) // read-only by default
```

## Runner

팝업은 러너를 재구현하지 않는다. `@contest/core`의 `describe`/`it`를 그대로
쓰고, 결과를 실시간 UI 로그로 흘리기 위해 `setReporter`를 구독한다.

```ts
import { describe, it, expect, setReporter, getResults } from '@contest/core'

setReporter((test) => log(test.passed ? `✓ ${test.name}` : `✗ ${test.name}`))
try {
  await describe('Page', () => {
    it('has a title', withPage(async (page) => {
      expect(await page.title()).toBeTruthy()
    }))
  })
} finally {
  setReporter(null)
}
```

테스트는 **직렬** 실행된다 — 동일 탭에 동시 CDP 세션을 열 수 없기 때문이다.

## Safety

- **읽기전용이 기본.** `guardPage`가 `click`/`type`/`goto`/`close`를 막는다.
  실 탭(어쩌면 프로덕션·로그인 상태)의 상태를 실수로 변형하지 않게 하기 위함.
- 인터랙션은 `guardPage(page, { mutate: true })`로 명시적 opt-in, 그마저도
  origin 허용목록(기본: 로컬 개발 호스트)을 통과해야 한다.

## UI Layout

```
┌──────────────────────────────┐
│ Contest E2E                  │
│                              │
│ Page Content                 │
│  ● has a title               │
│  ● has h1 element            │
│  ● can extract text content  │
│                              │
│ [ Run Tests on Current Tab ] │
│                              │
│ [log] ✓ has a title ...      │
└──────────────────────────────┘
```

## Open items

- 팝업의 테스트는 현재 하드코딩된 데모다. 사용자 작성 테스트(에디터/파일 로드)를
  받는 경로가 필요하다.
- 팝업의 인라인 `withPage`와 `@contest/e2e`의 `withPage`를 하나로 합칠 것.
- 번들 크기(현재 popup.js ~485KB, puppeteer-core 포함) 절감.
