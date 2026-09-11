# poke

개발 중인 내 앱을 코드로 찔러본다. 라이브 페이지 옆에 코드 버퍼 하나.

DevTools의 Sources > Snippets를 쓰다 보면 두 군데서 막힌다. poke는 그 두 개만 채운다.

- **신뢰된 입력** — `click`/`type`이 `webContents.sendInputEvent`로 내려가
  `event.isTrusted === true`인 이벤트를 만든다. 스니펫의 `el.click()`은 거짓이다.
- **내비게이션 생존** — 버퍼가 메인 프로세스에서 돌기 때문에 페이지가 넘어가도
  코드가 이어진다. 스니펫은 페이지 컨텍스트와 함께 사라진다.

Playwright를 대체하지 않는다. **테스트를 쓰기 전 단계**의 도구다. Playwright는 실행마다
새 컨텍스트를 열지만, poke는 앱이 켜져 있는 동안 로그인된 채 그 화면 그대로 남는다.
버퍼에서 `goto`를 빼면 지금 보고 있는 화면에 코드가 그대로 붙는다.

대상은 localhost와 개발 서버의 내 앱이다. 타사이트 자동화는 범위 밖이다.

## 실행

```sh
pnpm install
pnpm start
```

Ctrl+Enter 또는 Run 버튼으로 버퍼를 실행한다.

## 버퍼 API

| | |
| --- | --- |
| `goto(url)` | 이동 |
| `click(sel)` / `type(sel, text)` / `press(key)` | 신뢰된 입력 |
| `waitFor(sel, ms)` / `waitForNavigation(ms)` | 대기 |
| `text(sel)` / `attr(sel, name)` | 읽기 (요소를 기다린다) |
| `texts(sel)` / `count(sel)` | 개수 세기 (기다리지 않는다) |
| `url()` / `title()` / `evaluate(code)` | 페이지 상태 |
| `expect(v)` | vitest 매처 전체 (`toEqual` `toStrictEqual` `toMatchObject` `toContain` `toHaveProperty` `toBeCloseTo` …) |
| `sleep(ms)` / `log(...)` | 보조 |

`require`도 주입되어 있다. 메인 프로세스라 Node 전체가 열려 있고 MV3 CSP가 없다.

`click`, `type`, `text`, `attr`은 요소가 나타날 때까지 기다렸다가(기본 5초) 없으면
이유를 말하며 실패한다. 클라이언트에서 그리는 앱은 로딩이 끝난 뒤에 DOM이 생기므로
`goto` 직후에 바로 읽으면 아무것도 없다. 반대로 `count`와 `texts`는 기다리지 않는다.
없다는 것을 확인할 때 쓰라고 남겨둔 것이다.

단언은 `@vitest/expect`를 러너 없이 세워서 쓴다. `expect.any`, `expect.arrayContaining`
같은 비대칭 매처도 그대로 된다. 실패하면 diff가 로그에 붙는다.

`describe`와 `it`은 없다. 매처 호출마다 로그에 체크 표시가 한 줄씩 남고,
실패한 지점에서 실행이 멈춘다.

## 버퍼

시나리오별로 나눠 둔다. 상단 탭에서 전환하고, 더블클릭으로 이름 변경,
가운데 클릭으로 삭제한다. `userData/buffers/*.js`에 평범한 JS 파일로 저장된다.

## 검증

```sh
pnpm smoke
```

Xvfb 위에 앱을 띄우고 자기 UI를 CDP로 조작해 13개 항목을 확인한다.
`isTrusted: true`와 이동 후 코드 계속 실행이 핵심이다.

## 구조

메인과 preload는 `tsc`로 CommonJS, 렌더러는 Vite로 ESM 번들이다.
Electron에서 함정이 가장 적은 조합이다.

```
src/main/      index.ts api.ts runner.ts buffers.ts expect.ts
src/preload/   index.ts
src/renderer/  index.html main.ts editor.ts styles.css
src/shared/    types.ts
test/          smoke.mjs
```

`runner.ts`는 `new AsyncFunction`이 본문을 감싸며 밀리는 줄 번호를 보정한다.
오프셋은 현재 V8에서 2지만 하드코딩하지 않고 기동 시 1회 측정한다.

`expect.ts`는 vitest 매처를 Proxy로 감싸 호출마다 로그를 남긴다.

## 어쩌다 여기까지 왔는가

이 저장소는 `contest`라는 이름으로 "브라우저 런타임에서 e2e 테스트를 실행한다"에서
시작했다. 실제 동기는 개발하면서 내 앱을 가볍게 찔러보는 것이었고, 그 간극이
오래 남았다. 확장 기반 구현을 실제로 측정하고 나서 방향을 정리했다.

1. **MV3는 확장 페이지에서 `eval`을 막는다.** 그래서 이전 구현의 "사용자 작성 테스트"
   기능은 실제로 동작한 적이 없었다.
2. **Chrome 136은 기본 프로필의 원격 디버깅을 막았다.** 이미 열려 있는 내 크롬에
   붙는 길은 확장뿐이고, 그 문은 닫히는 방향이다.
3. **Electron에서는 이 제약이 전부 사라진다.** 메인 프로세스는 그냥 Node다.
   대신 내 크롬의 로그인 세션은 따라오지 않는데, 대상이 내 개발 서버라면 비용이 아니다.

측정 결과는 [`docs/findings.md`](docs/findings.md)에 있다.
확장 기반의 이전 구현은 `27ee266` 이전 커밋에 남아 있다.

## 라이선스

MIT
