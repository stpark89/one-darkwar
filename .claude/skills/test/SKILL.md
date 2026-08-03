---
name: test
description: 대상 파일/기능의 단위·위젯·시나리오 테스트를 작성하고 실행할 때 사용. "테스트 작성/실행"에 발동. 테스트 스택·패턴은 현 프로젝트 conventions를 따른다(스택별 분기 — 웹 Vitest / Flutter flutter_test / FastAPI pytest).
---

# Test (스택 중립)

## 먼저 읽기
현 프로젝트 **conventions의 `## 검증` 섹션**에서 테스트 스택·실행 명령을 확인한다. 스택별로 다르다:

| 스택 | 프레임워크 | 실행 |
|---|---|---|
| `ts-vite-react`/`ts-next` | Vitest + Testing Library | `npm test` |
| `flutter-app` | flutter_test (widget/unit) | `flutter test` |
| `py-fastapi` | pytest + httpx(TestClient) | `uv run pytest` |

## 작성 우선순위 (conventions 레이어 순서대로)

레이어의 바깥(I/O)부터가 아니라 **순수 로직·계약부터** 덮는다. 스택별 예:

- **웹(ts-\*)**: api 함수(`apiClient` mock) → Query 훅(`QueryClientProvider` 래퍼) → 컴포넌트(`userEvent`) → 페이지 흐름
- **Flutter**: services 순수 로직 → data(클라이언트 mock) → Riverpod 컨트롤러(State 전이) → 위젯(`pumpWidget`+`tester`)
- **FastAPI**: services 도메인 로직(순수) → repositories(테스트 DB/세션) → routers(`TestClient`로 엔드포인트 E2E)

마지막은 항상 **시나리오 1개**(given/when/then) — 핵심 플로우 한 줄.

## 테스트 파일 위치 (conventions 관례)
- 웹: 대상과 같은 디렉토리 `.test.ts(x)`
- Flutter: `test/` 하위에 `lib/` 구조 미러 (`xxx_test.dart`)
- FastAPI: `app/tests/` (`test_xxx.py`)

## 실행·보고
- 위 표의 실행 명령 → `✅ 통과 N / ❌ 실패 N` + 실패 원인
- **자동 테스트로 못 덮는 표면**(실제 렌더·화면 전이·외부 I/O)은 `verify`/`run`으로 수동 관찰하거나 "PM 실측 요망"으로 분리한다 — 완료 = 자동 통과 + 표면 확인 둘 다.
- 실패: 코드 버그 → 즉시 수정 / 설계 불일치 → `/design-ui` 재설계 권장
- 전체 통과 → `.tasks/in-progress.md` → `.tasks/done.md` 이동
