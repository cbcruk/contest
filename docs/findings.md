# 측정 결과

poke 이전의 확장 기반 구현(`contest`)을 접기 전에 실제로 측정한 것들.
전부 Chromium 136을 Xvfb 위에 띄우고 unpacked MV3 확장을 로드해 확인했다.
검색으로 한 페이지에 나오지 않는 내용이라 남긴다.

## 1. MV3 확장 페이지에서 동적 코드 실행

| 검사 | 실행 위치 | 결과 |
| --- | --- | --- |
| `eval` / `new Function` | 확장 페이지 | **차단** |
| `blob:` 모듈 import | 확장 페이지 | **차단** |
| `data:` 모듈 import | 확장 페이지 | **차단** |
| `new Function` / `AsyncFunction` | sandbox 페이지 | 통과 |
| `blob:` 모듈 그래프 | sandbox 페이지 | **차단** |
| 레지스트리 모듈 그래프 | sandbox 페이지 | 통과 |

확장 페이지의 기본 CSP는 `script-src 'self'`이고 MV3는 `unsafe-eval`을 허용하지 않는다.

```
Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an
allowed source of script in the following Content Security Policy directive:
"script-src 'self'".
```

매니페스트의 `sandbox.pages`로 선언한 페이지는 전용 CSP에 `unsafe-eval`을 넣을 수 있어
`new Function`이 열린다. 다만 **opaque origin**이라 `URL.createObjectURL`이
`blob:null/...`을 뱉고 그건 fetch가 안 된다. 명세자를 절대 URL로 재작성해도 같다.

그래서 sandbox에서 모듈 그래프를 돌리려면 ESM을 함수 래핑 모듈로 변환하고
레지스트리로 엮어야 한다. 두 파일짜리 그래프에서 `add(1, 2)`가 `3`으로 돌아왔다.
vite module-runner가 쓰는 모양과 같다.

### 함정

CDP `Runtime.evaluate`는 **페이지 CSP를 우회한다.** DevTools 콘솔이나 puppeteer의
`page.evaluate`로 `new Function`을 시험하면 무조건 거짓 통과가 나온다.
확장 자신의 번들에서 실행해야 실제 동작을 본다. 이 기능이 동작한 적 없는데도
오래 발견되지 않은 이유다.

## 2. sandbox에서 라이브 탭 구동

sandbox 프레임은 `chrome.*` API에 접근할 수 없지만, `postMessage`로 권한 있는
부모 페이지에 CDP 명령을 올리고 부모가 `chrome.debugger`로 실행하면 된다.
sandbox의 테스트 코드가 라이브 탭의 `document.title`을 읽어오는 것까지 확인했다.

즉 확장으로 계속 갔다면 구조는 이랬다. 권한 있는 페이지가 CDP와 파일 접근을 쥐고,
sandbox 프레임이 코드를 평가하고, 둘 사이를 postMessage RPC가 잇는다.

## 3. Fetch.fulfillRequest 로 가상 모듈 서빙

`Fetch.enable` 후 `Fetch.requestPaused`를 받아 `Fetch.fulfillRequest`로 응답하면
HTTP 서버 없이 페이지에 모듈을 주입할 수 있다. 페이지에서
`import('/virtual/mod.js')`가 합성한 소스를 실제로 실행했다.

단, 테스트 코드가 확장 페이지에서 돌고 탭을 CDP로 구동하는 구조라면 이건 쓸 데가 없다.
탭이 그 모듈을 가져가는 쪽이 아니기 때문이다. 인페이지 실행으로 갈 때만 의미가 있다.

## 4. Chrome 136의 원격 디버깅 제한

| 실행 방식 | `/json/version` | 결과 |
| --- | --- | --- |
| 기본 프로필 (`--user-data-dir` 미지정) | 빈 응답 | 연결 불가 |
| 명시적 `--user-data-dir` | 정상 응답 | 연결 가능 |

기본 프로필에서는 WebSocket 주소가 stderr에 찍히긴 하지만 HTTP 탐색 엔드포인트가
죽어 있다. puppeteer의 `browserURL` 연결이 이 엔드포인트에 의존하므로 사실상 막혔다.

**이미 로그인된 채 쓰고 있는 진짜 크롬에 붙는 방법은 확장(`chrome.debugger`) 하나뿐이다.**
그리고 크롬은 이 문을 여는 게 아니라 닫는 방향으로 가고 있다.

## 5. AsyncFunction 스택 오프셋

`new AsyncFunction(args, body)`는 본문을 함수 선언으로 감싸므로 스택의 줄 번호가
사용자 소스에서 밀린다. 측정한 오프셋은 **2**이고, 인자 개수와 무관하게 일정하다.
동기 `Function` 생성자도 같은 2줄 접두사를 만들어서 await 없이 잴 수 있다.

API 함수 안에서 던진 오류도 스택의 첫 `<anonymous>` 프레임이 그 API를 호출한
사용자 줄을 가리킨다. `src/main/runner.ts`가 이걸 쓴다.

## 6. @vitest/expect 를 러너 없이 쓰기

매처만 빌려 쓰는 건 된다. chai 플러그인 셋과 `setState` 한 번이면 끝이고,
`toMatchObject`·`arrayContaining`·`expect.any`·`toBeCloseTo` 같은 것들이 전부 동작한다.
문서에 없는 함정이 두 개 있다.

- **`setState`의 두 번째 인자는 expect 함수 자체여야 한다.** 같이 export되는
  `GLOBAL_EXPECT`를 넘기면 심볼이라 `Invalid value used as weak map key`로 터진다.
- **`diff()`의 `noColor: true`가 듣지 않는다.** tinyrainbow가 환경을 보고 결정해서
  ANSI가 그대로 남는다. HTML에 넣으려면 직접 걷어내야 한다.

손수 짠 deepEqual과 22개 케이스로 비교했을 때 직접 구현 쪽 오답이 두 개였다.
`Set`의 객체 원소를 `has()`로 찾아 참조 비교가 되던 것과, 희소 배열 `[1,,3]`을
`[1,undefined,3]`과 같다고 본 것. `node:util`의 `isDeepStrictEqual`은 22개를
모두 맞히므로, 매처가 필요 없고 동등성만 필요하면 그쪽이 의존성 없는 답이다.
