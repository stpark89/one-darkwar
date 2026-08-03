---
name: develop-task
description: 태스크명(태그 포함)을 받아 현 프로젝트 conventions의 레이어 규칙대로 코드를 생성하고 검증 후 태스크 상태를 갱신할 때 사용. "[Page]/[API]/[Router]/[State]… 구현해줘"에 발동. 스택별로 분기 — 레이어 규칙·검증 명령은 현 conventions를 1순위로 따른다.
---

# Develop Task (스택 중립)

## 먼저 읽기
- `CLAUDE.md`, `.tasks/backlog.md`, `.tasks/design/`
- **현 프로젝트 conventions 스킬** — 태그→구현위치, 레이어 규칙, `## 검증` 섹션 (**1순위 기준**)
- 관련 횡단 모듈 — `api-client`/`tanstack-query`(데이터), `supabase-auth`(인증), `design-system`(웹 UI)
- 같은 도메인 기존 코드 — 패턴 일관성

## 구현 규칙

1. 태스크 **태그**로 구현 위치 판단 — 태그 체계는 스택마다 다르므로 **현 conventions 스킬의 `## 태스크 태그` 섹션을 그대로 따른다**(SSOT는 conventions, 여기 나열하지 않는다).
2. **그 레이어의 단방향 규칙대로** 작성한다. 공통 불변 원칙(스택 무관):
   - **I/O는 한 레이어에 가둔다** — 데이터 접근을 화면/라우터에 흩지 마라.
     - 웹: 서버데이터=Query 훅 / Next 서버컴포넌트·Server Action (`useEffect` 수동 페칭·Zustand 저장 금지), 호출은 `apiClient` 경유(날것 fetch 금지)
     - Flutter: data 계층은 순수 조회만(상태변경 X), 갱신은 Riverpod 컨트롤러가 (위젯이 data 직접 호출 X)
     - FastAPI: DB 접근은 repository에만, router는 얇게(검증→service 호출→응답), DTO≠ORM
   - **전역 상태만 전역에** — 웹 Zustand·Flutter Riverpod은 전역만. 화면 전용 일시상태는 `useState`/`setState`로 화면 안에.
   - **인증 판단은 서버/RLS 기준** — 클라 불린으로 권한 결정 금지(`supabase-auth`).
3. UI면 **디자인 토큰**(하드코딩 금지) — 웹: `design-system` 토큰·컴포넌트 재사용 / Flutter: `AppColors`·`AppRadius`·`AppSpacing`.

## 검증·기록
- **conventions `## 검증` 섹션의 명령을 실행**해 오류 0 확인(스택별: 웹 `tsc --noEmit`·build / Flutter `flutter analyze`·`test` / FastAPI `ruff`·`mypy`·`pytest`). 오류는 즉시 수정.
- **정적 게이트 통과 ≠ 완료.** UI·플로우·엔드포인트를 건드렸으면 **실제 표면에서 관찰가능 결과 1개를 확인**한다 — `verify`/`run` 스킬로 앱을 띄워 그 플로우를 직접 구동(웹/Flutter: preview로 화면·전이 / FastAPI: curl·TestClient로 응답). "빌드/타입 통과"만으로 완료 처리 금지 — 렌더 크래시·인증·전이 끊김은 실행해야 보인다.
- `.tasks/backlog.md` `- [ ]`→`- [x]`, `.tasks/in-progress.md`에 완료내역 + **확인한 표면 결과 한 줄**.
- 요약 + 다음 태스크 안내.
