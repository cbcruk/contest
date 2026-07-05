# contest — 방향성 결정 (Direction)

> Status: Decided (2026-07)
> 이 문서는 이전 설계 노트("길 A vs 길 B", "execute 격리 substrate 확정")를
> **코드가 실제로 도달한 상태**에 맞춰 갱신한 것이다.

## TL;DR

- 이전 노트가 붙들던 **"`execute`의 격리 substrate(eval/iframe/worker)를 확정하라"는 질문은 무의미해졌다.** 실제 제품은 `execute`로 테스트를 돌리지 않는다.
- 프로젝트는 이미 **길 B(부착형 라이브 검증)** 로 갔다. 구현 substrate는 **puppeteer-core + CDP(`chrome.debugger`) 부착**이다.
- 남은 실제 결정은 substrate가 아니라 **(1) 갈라진 두 익스텐션 설계의 통합**과 **(2) 읽기전용 vs 인터랙션 구동의 안전 축**이다.

## 1. 코드가 확정한 사실

| 이전 노트의 열린 질문 | 코드가 준 답 |
| --- | --- |
| `execute`의 격리 substrate는? | `new AsyncFunction` = **격리 0**. docstring도 "No sandbox isolation" 명시 (`packages/sandbox/src/index.ts`). |
| 길 A(부팅형)인가 B(부착형)인가? | **B**. `packages/e2e`와 `packages/extension`이 puppeteer-core `ExtensionTransport.connectTab`으로 이미 열린 탭에 attach. |
| sandbox는 critical path인가? | **아니다.** 익스텐션도 e2e도 `execute`를 호출하지 않는다. `@contest/sandbox`는 vestigial. |

매니페스트 이름도 `Contest`(브라우저 테스트 러너) → **`Contest Puppeteer`("Run Puppeteer tests from your browser")** 로 이동했다. 정체성은 이미 바뀌었다.

## 2. 코드에 생긴 균열

### (a) 익스텐션 설계가 둘로 갈라져 있다

| | `docs/extension-design.md` (문서) | `packages/extension` (실제 코드) |
| --- | --- | --- |
| 진입점 | DevTools Sources 사이드바 (`devtools_page`) | 팝업 (`default_popup`) |
| 실행 | `inspectedWindow.eval` — 페이지 **안에** 주입 | puppeteer-core `debugger` — 페이지 **밖에서** CDP 구동 |
| 성격 | 인페이지 · 경량 · 스니펫 · 관측 위주 | 아웃오브페이지 · click/type 구동 · 무거움 |

두 설계는 철학이 양립 불가능하다(인페이지 주입 vs 외부 CDP 구동).

### (b) 러너가 세 번 재구현돼 있었다

`describe`/`it`이 `core.ts`, `popup.tsx`, README에 각각 존재했고 실행 의미론이 달랐다.
- `core.ts`: 즉시 실행(eager) + `Promise.all`(동시). **`describe`를 await하지 않으면 `addTest`가 suite 마감 후 microtask에서 실행돼 깨진다.** (브라우저 테스트 9/9 실패로 확인)
- `popup.tsx`: thunk 지연 + 직렬 await. **올바른 모델** — puppeteer attach는 동일 탭에 동시 세션을 못 열기 때문에 직렬이어야 한다.

## 3. 결정

1. **길 B로 확정. 길 A 야망은 접는다.** 손으로 짠 러너로 Vitest browser mode와 정면 경쟁하지 않는다.
2. **익스텐션 아키텍처는 puppeteer-CDP 팝업(이미 만든 것)으로 단일화.** 가치의 핵심: 새 브라우저를 띄우지 않고 **지금 로그인된 채 보고 있는 그 탭**에 그대로 붙는다 — puppeteer가 통상 fresh context를 여는 것과 반대. DevTools `inspectedWindow.eval` 방식은 이 attach가 상위호환하므로 접는다.
3. **러너는 `@contest/core` 하나가 진실의 원천.** 직렬 thunk 모델로 통일하고 각 표면은 import만 한다. (버그 수정 겸함)
4. **읽기전용을 기본 불변식으로 박는다.** assertion은 관측(title, `$eval`, computed style, 가시성, ARIA)이 기본. mutation(click/type/goto)은 명시적 opt-in, 궁극적으로 프로덕션 origin에서 거부하는 가드까지. (이전 노트 #74의 실현)
5. **`@contest/sandbox` 삭제됨.** 격리 0이고 아무도 안 썼다. 인페이지 primitive가 다시 필요해지면 재도입.

## 4. 로드맵 (재정렬)

- [x] 러너 3중 재구현 → `@contest/core` 단일화 (+ 직렬 실행 버그 수정, reporter 훅)
- [x] README를 실제 정체성(puppeteer attach)에 정합화
- [x] 읽기전용 기본 + mutation opt-in 가드 (`@contest/e2e`의 `guardPage`, origin 허용목록)
- [x] `docs/extension-design.md`를 실제 팝업 설계로 갱신
- [x] `@contest/sandbox` 삭제
- [x] matcher 확장(`toContain`, `toThrow`, `toHaveLength`)
- [x] 팝업 인라인 `withPage`를 `@contest/e2e`로 통합 + 사용자 작성 테스트(편집·`chrome.storage` 보존)
- [x] 중첩 `describe`, `it.skip`/`it.only` (수집→실행 2단계 모델)
- [x] `beforeEach`/`afterEach` 훅 (조상 상속, 실패해도 afterEach 실행)
- [ ] `beforeAll`/`afterAll` 훅
- [ ] 번들 크기 절감(팝업이 puppeteer-core 포함)

## 5. 한 줄 재개 지점

> 이전 재개 지점("execute 격리 확인 → 길 A/B 판별 → substrate 확정")은 소진됨.
> 다음 결정: **읽기전용을 불변식으로 박은 puppeteer-attach 도구로서 assertion DSL과 mutation 가드를 어떻게 설계할 것인가.**
