# poke

개발 중인 내 앱을 코드로 찔러본다. 라이브 페이지 옆에 코드 버퍼 하나.

DevTools Snippets가 못 하는 두 가지를 채우는 것이 전부의 목적이다.

- **신뢰된 입력** — `click`/`type`은 `webContents.sendInputEvent`로 내려가
  `event.isTrusted === true`인 이벤트를 만든다. 스니펫의 `el.click()`은 거짓이다.
- **내비게이션 생존** — 버퍼는 메인 프로세스에서 돌기 때문에 페이지가 넘어가도
  코드가 이어진다. 스니펫은 컨텍스트와 함께 사라진다.

Playwright를 대체하지 않는다. 테스트를 쓰기 **전** 단계의 도구다. Playwright는
실행마다 새 컨텍스트를 열지만, poke는 앱이 켜져 있는 동안 로그인된 채 그 화면
그대로 남는다. 버퍼에서 `goto`를 빼면 지금 보고 있는 화면에 코드가 그대로 붙는다.

대상은 localhost와 개발 서버의 내 앱이다. 타사이트 자동화는 범위 밖이다.

## 실행

```sh
pnpm --filter poke start
```

Ctrl+Enter 또는 Run 버튼으로 버퍼를 실행한다.

## 버퍼 API

| | |
| --- | --- |
| `goto(url)` | 이동 |
| `click(sel)` / `type(sel, text)` / `press(key)` | 신뢰된 입력 |
| `waitFor(sel, ms)` / `waitForNavigation(ms)` | 대기 |
| `text(sel)` / `texts(sel)` / `count(sel)` / `attr(sel, name)` | 읽기 |
| `url()` / `title()` / `evaluate(code)` | 페이지 상태 |
| `expect(v)` | `toBe` `toEqual` `toContain` `toHaveLength` `toBeTruthy` `toBeFalsy` `toBeNull` `toThrow` |
| `sleep(ms)` / `log(...)` | 보조 |

`require`도 주입되어 있다. 메인 프로세스라 Node 전체가 열려 있고 MV3 CSP가 없다.

`describe`와 `it`은 없다. 단언은 로그에 한 줄씩 체크 표시로만 남는다.

## 버퍼

시나리오별로 나눠 둔다. 상단 탭에서 전환하고, 더블클릭으로 이름 변경,
가운데 클릭으로 삭제한다. `userData/buffers/*.js`에 평범한 JS 파일로 저장된다.

## 검증

```sh
pnpm --filter poke smoke
```

Xvfb 위에 앱을 띄우고 자기 UI를 CDP로 조작해 12개 항목을 확인한다.
`isTrusted: true`와 이동 후 코드 계속 실행이 핵심이다.

## 구조

메인과 preload는 `tsc`로 CommonJS, 렌더러는 Vite로 ESM 번들이다.
Electron에서 함정이 가장 적은 조합이다.

```
src/main/      index.ts api.ts runner.ts buffers.ts expect.ts
src/preload/   index.ts
src/renderer/  index.html main.ts editor.ts styles.css
src/shared/    types.ts
```

`runner.ts`는 `new AsyncFunction`이 본문을 감싸며 밀리는 줄 번호를 보정한다.
오프셋은 현재 V8에서 2지만 하드코딩하지 않고 기동 시 1회 측정한다.
