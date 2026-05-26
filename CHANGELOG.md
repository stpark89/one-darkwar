# CHANGELOG

## [Unreleased]

### Changed
- **BLACK GOLD 전쟁 참가 탭**: 참여 방식을 A·CT / A·DB / B·CT / B·DB → ✓ (참여) / ✕ (미참여) 단순화
  - 팝오버 버튼 4개 → [✓ 참여] + [✕] 2개로 축소
  - 저장 시 `role: 'CT'` 로 통일 (기존 데이터 backward compatible)
  - 랭킹 탭에서 CT/DB/A팀/B팀 세부 분류 제거 → 총 참여 횟수만 표시

---

## 2026-05-25

### Added
- **이주 신청 상태 조회** — 신청자 본인이 자신의 신청 상태 및 관리자 메시지를 확인 가능
- **게스트 '둘러보기' 모드** — 로그인 없이 앱 주요 화면을 미리 탐색 가능 (`GuestHomePage`)
- **Web Push 알림** — 이주 신청 시 관리자에게 푸시 알림 전송 (`src/lib/push.ts`, Service Worker)
- **이주 신청 관리자 메시지** — 번역 토글 포함 (한국어 ↔ 원문)
- **가입 거절 처리** — 거절 메시지 입력 + 거절된 사용자 로그인 차단
- **중복 API 호출 방지** — `initialized` 플래그 패턴 전체 store에 적용 (`c88f8c6`)

### Fixed
- PWA 휴면 후 무한 로딩 (홈, 로그인, 레이아웃 spinner) 다수 수정
- 비밀번호 변경 false-success 버그 수정
- 멤버 이름 변경 시 로그인 계정(authStore)도 자동 동기화
- 이주 신청 조회 무한 로딩 방지 + 줄바꿈 개선

### Changed
- **VS POINT 회차와 BLACK GOLD 회차 완전 분리** — `vs_rounds` 테이블 신설, `vsPointStore` 분리
- 멤버 삭제: 즉시 삭제 → confirm 모달 + cascade 경고
- iOS 환경 개선: safe-area, dvh, tap-highlight 제거, input 줌인 방지
- 이주 신청 관리: 티켓 4개 제한 + 모바일 압축 UI + 검색·필터

---

## 2026-05-24

### Added
- **PWA** — `manifest.webmanifest`, Service Worker, 앱 아이콘, Android maskable 아이콘
- **이주 신청 기능** (`TransferPage`, `TransferStatusPage`) — 사용자 직접 티켓 등급 선택, UID 필드, 관리자 대시보드
- **게스트 궁금한점** (`GuestQuestionsPage`) — 비로그인 사용자 질문 제출
- **채팅 플로팅 버튼 드래그** — 위치 이동 가능
- **PWA 앱 새로고침 버튼** — 설치된 앱에서 새 버전 강제 적용
- **CLAUDE.md** — AI 협업 컨벤션 문서 작성

### Fixed
- PWA 새 설치 후 무한 로딩 근본 원인 수정
- Layout spinner 5초 안전망 (검은 화면 방지)
- 로그인 무한 로딩 (`handleSubmit` / `signIn` try-finally 보장)
- 가입관리 / 궁금한점 무한 로딩 안전망

### Changed
- 로그인 화면: 로고를 동맹 아바타로 교체, 부제목 제거
- 사이드바 '전쟁 참가' 라벨 → 'BLACK GOLD'
- 국가 선택: native select → 국기 그리드 + LangSelector 패턴 드롭다운
- 등급 설정을 이주 신청 관리 화면으로 통합
- 모든 store `try-finally` 로딩 패턴 통일

---

## 2026-05-23 (BLACK GOLD 전쟁 기능 리뉴얼)

### Added
- **전쟁 참가 탭 전면 개편**
  - 셀 클릭 시 팝오버로 참여 여부 + 메모 입력
  - 보류(pending) 변경사항 추적 — 저장/취소 바
  - 회차별 날짜 편집 (헤더 pencil 아이콘)
  - 회차 날짜 기준 자동 정렬
  - 메모 입력 시 주황 점 표시
- **VS POINT 탭** — 회차별 포인트 문자열 자유 입력, 배치 저장
- **이벤트 페이지 다국어 완성** — `MemberAttendanceModal` 전체 `t()` 처리
- **참여 단순화** — A·CT / A·DB / B·CT / B·DB → ✓ / ✕

### Changed
- `warStore`: `initialized` 플래그, `loadData(force?)`, `batchSave`, `updateRoundDate` 개선
- `ExcelPage`: `updateEntry` 제거 → `batchSave` 배치 저장으로 교체

---

## 2026-05-14

### Added
- 다국어(i18n) 지원 — 한국어 / 영어 / 베트남어 / 번체 중국어
- 비밀번호 변경
- 반응형 레이아웃
- 채팅 기능
- 권한 관리 (관리자/일반 구분)
- 기여도 확인 페이지

---

## 2026-05-13 (최초 릴리즈)

### Added
- 멤버 관리 (등록 / 수정 / 삭제 / 정렬)
- 회원가입 / 로그인 / 접속 현황
- 사이드바 fold 기능
- Supabase DB 연동
- Vercel 배포
