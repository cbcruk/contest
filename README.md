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

```sh
pnpm install
pnpm --filter poke start
```

자세한 사용법은 [`packages/poke/README.md`](packages/poke/README.md)에 있다.

## 어쩌다 여기까지 왔는가

이 저장소는 `contest`라는 이름으로 "브라우저 런타임에서 e2e 테스트를 실행한다"에서
시작했다. 실제 동기는 개발하면서 내 앱을 가볍게 찔러보는 것이었고, 그 간극이
오래 남았다. 세 가지를 확인하고 나서 방향을 정리했다.

1. **MV3는 확장 페이지에서 `eval`을 막는다.** 그래서 아래 `packages/extension`의
   "사용자 작성 테스트" 기능은 실제로 동작한 적이 없다. Run을 누르면 CSP 오류가 난다.
2. **Chrome 136은 기본 프로필의 원격 디버깅을 막았다.** `/json/version`이 빈 응답이다.
   즉 이미 열려 있는 내 크롬에 붙는 길은 확장뿐이고, 그 문은 닫히는 방향이다.
3. **Electron에서는 이 제약이 전부 사라진다.** 메인 프로세스는 그냥 Node다.
   대신 내 크롬의 로그인 세션은 따라오지 않는데, 대상이 내 개발 서버라면 비용이 아니다.

과정은 [`docs/direction.md`](docs/direction.md)에 남아 있다.

## 이전 패키지

`packages/contest`, `packages/e2e`, `packages/extension`은 확장 기반의 이전 구현이다.
아직 정리하지 않았고 poke는 이들에 의존하지 않는다. 참고할 때 두 가지를 유의할 것.

- 확장의 사용자 작성 테스트는 MV3 CSP 때문에 동작하지 않는다.
- `@contest/core`의 `toEqual`은 JSON 문자열 비교라 키 순서, `undefined` 속성,
  `NaN`, `Date`, `Map`에서 오답이 나온다. poke는 재귀 비교로 다시 썼다
  (`packages/poke/src/main/expect.ts`).

## 라이선스

MIT
