# Contest DevTools Extension Design

> Status: Draft (not implemented)

## Overview

DevTools Sources 패널에 Sidebar를 추가하여 테스트 결과를 표시하는 방식.
사용자는 기존 Snippets 에디터를 활용하고, extension은 결과 표시만 담당.

## Structure

```
extension/
├── manifest.json
├── devtools.html
├── devtools.js
└── sidebar/
    ├── sidebar.html
    └── sidebar.js
```

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "Contest",
  "version": "0.1.0",
  "description": "Browser-based test runner for DevTools",
  "devtools_page": "devtools.html"
}
```

## Core APIs

```js
// devtools.js - Sidebar 생성
chrome.devtools.panels.sources.createSidebarPane('Contest', (sidebar) => {
  sidebar.setPage('sidebar/sidebar.html')
})

// sidebar.js - 페이지에서 코드 실행
chrome.devtools.inspectedWindow.eval(code, (result, error) => {
  // 결과 처리
})
```

## User Flow

```
1. F12 → DevTools 열기
2. Sources 탭 → 우측에 "Contest" sidebar 표시
3. "Inject Contest" 클릭 → 페이지에 contest 프레임워크 주입
4. Snippets에서 테스트 코드 작성
5. Snippet 실행 (Cmd+Enter)
6. "Run Tests" 클릭 → sidebar에 결과 표시
```

## UI Layout

```
┌─────────────────────────────────────────────┐
│ Sources                                      │
├──────────────────────┬──────────────────────┤
│ Snippets (기존)      │ Contest (sidebar)    │
│                      │                      │
│ describe('...', ()   │ [Inject] [Run] [Clear]│
│   it('...', () =>    │                      │
│     expect(...)      │ ✓ test 1             │
│   })                 │ ✓ test 2             │
│ })                   │ ✗ test 3             │
│                      │   Error: ...         │
└──────────────────────┴──────────────────────┘
```

## Advantages

- DevTools 기본 에디터(Snippets) 활용 → 별도 에디터 불필요
- 현재 페이지 컨텍스트에서 실행 → DOM 접근 가능
- 설치만 하면 어떤 사이트에서든 사용 가능

## Implementation Notes

- `chrome.devtools.inspectedWindow.eval()`로 contest 코드 주입
- 결과는 `window.__contest__.getResults()`로 수집
- Sidebar는 DevTools 테마(light/dark) 자동 적용
