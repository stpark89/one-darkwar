---
name: design-ui
description: 화면(또는 백엔드면 API 계약)을 받아 와이어프레임·컴포넌트(위젯) 트리·상태 설계를 만들고 .tasks/design/에 저장할 때 사용. "화면 설계", "UI 구조", "API 설계"에 발동. 스택별로 분기 — 웹/Flutter는 UI 설계, FastAPI는 엔드포인트·스키마 계약 설계.
---

# Design (UI / API 계약) — 스택 중립

## 먼저 읽기
- `CLAUDE.md`, `.tasks/backlog.md`
- **디자인 토큰 출처** — 웹: `design-system`(DESIGN.md/tokens.md) / Flutter: `flutter-app`의 "디자인 토큰" 섹션(`theme.dart`)
- 현 프로젝트 **conventions** — 폴더구조/컴포넌트(위젯) 배치, 레이어 규칙

## 스택별 산출

### UI 있는 스택 (ts-vite-react / ts-next / flutter-app)
1. **와이어프레임** (ASCII 레이아웃)
2. **컴포넌트/위젯 트리** — conventions 폴더구조 기준
   - Next → 서버/클라이언트 컴포넌트 구분 표시
   - Flutter → 위젯 트리 + `ConsumerWidget`/`StatefulWidget` 구분
3. **상태 설계** — 반드시 구분:
   - **서버 상태** → 웹: Query 훅 / Next 서버컴포넌트·Server Action · Flutter: data 호출 → Riverpod 컨트롤러
   - **전역 클라 상태** → 웹: Zustand(UI 전역만) · Flutter: Riverpod(전역만)
   - **화면 전용** → 웹: `useState` · Flutter: `setState`
4. **데이터 흐름** (조회/변경 경로)

### UI 없는 백엔드 (py-fastapi) — 계약 설계로 대체
1. **엔드포인트 표** — method·path·인증여부·요약
2. **요청/응답 스키마** — Pydantic DTO 필드(타입·필수·검증)
3. **레이어 흐름** — router → service → repository → model, 각 책임
4. **에러·상태코드** 계약 (4xx/5xx 케이스)

## 공통: 저장
`.tasks/design/<화면 또는 엔드포인트군>.md`로 저장.

## 디자인 준수 (UI 스택 한정)
색·spacing·radius는 토큰만(하드코딩 금지). 웹은 `DESIGN.md` 컴포넌트 재사용, Flutter는 `AppColors`/`AppRadius`/`AppSpacing`. 없으면 제안.

## 다음
`/develop-task "[첫 태그] <대상> …"` (태그는 현 conventions 체계)
