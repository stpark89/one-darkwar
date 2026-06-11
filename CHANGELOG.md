# CHANGELOG

## 2026-06-09

### Added
- **이주 신청 메모(note) 필드 추가** — 신청서에 관리자에게 남길 메모 필드 추가
- **합산 전투력(Migration Score) 필드 추가** — 등급 자동 매칭 기준으로 사용 (`total_power`)
- **등급표 참조 UI** — 신청 폼 내 Migration Score 기준 등급 구간 팝업 표시 (`TierReference`)
- **291 서버 홈 페이지** — `/server` 경로로 분리, 서버 공용 정보 위젯 모음
  - 이주 모집 현황 위젯 (`RecruitmentWidget`)
  - 서버 일정/이벤트 위젯 + 카운트다운 (`ServerEventsWidget`)
  - 동맹 목록 위젯 — 세력도/외교 정보 (`AllianceWidget`)
  - 최근 문의 위젯 (`RecentQuestionsWidget`)
- **점령 순번 관리 메뉴** — 무기고·왕성 점령 차례 관리 (`OccupationPage`, `/server/occupation`)
- **이주 신청 v2** — 단체 신청(그룹) + 희망 동맹 선택 + 게스트 UID 조회
  - `application_groups` 테이블 + `submit_transfer_group` RPC
  - 관리자 화면: 그룹 카드로 묶기 + 일괄 승인/거절
- **이주 신청 통계 대시보드** — 관리자 화면에 티켓 등급별 승인 현황
- **이주 신청 내역 페이지** — `/transfer/list`, 관리자 상세 모달 포함 (`TransferListPage`)
- **이주 신청서 수정 기능** — 신청자가 PENDING/REJECTED 상태에서 내용 수정 후 재제출 가능 (`TransferStatusPage`)
- **사이드바 섹션 분리** — ONE 동맹 / 291 서버 / 관리자 3개 섹션으로 구분
- **티켓 등급 색상** — orange / purple / blue / gray 4가지 색상 지원 + 기본 시드 데이터
- **291 서버 홈 언어 선택기** — 상단 헤더에 언어 전환 버튼 추가

### Fixed
- VS 포인트 합계 부동소수점 오차 제거 (`62.400000000000006` → `62.4`)
- CP 파싱 `3G45` 형식 보정 (G/B를 소수점 구분자로 해석)
- 이주 등급 — 사용자 선택값만 사용 (CP 자동 매칭 제거 후 Migration Score 기준으로 재전환)
- 로그인 멤버에게 291 서버 섹션 '궁금한 점' 메뉴 노출
- 둘러보기 모드에서 홈 메뉴 중복 활성화 제거
- 이주 신청 내역 `/transfer`와 `/transfer/list` 사이드바 동시 active 충돌 수정

### Changed
- **이주 신청 폼 개선** — UID 위치 상단 이동, placeholder 명확화 (Migration Score / UID 안내)
- **게스트 메뉴 통일** — 둘러보기 모드 제거, 전체 메뉴 항상 노출
- **이주 신청 내역 카드** — CP 숨김 처리

---

## 2026-06-05

### Added
- **이주 신청서 수정 기능** — 신청자 본인이 PENDING/REJECTED 상태에서 내용 수정 후 PENDING으로 재제출 (`TransferStatusPage`)
- **멤버 목록 메모 검색** — 검색창에서 메모(note) 필드도 검색 가능
- **모바일 멤버 메모 표시** — 모바일 환경에서 이름 하단에 "메모: ..." 형태로 표시

### Fixed
- **멤버 삭제 시 연관 데이터 제거** — Black Gold, VS Point, 이벤트 참가 메뉴에서도 해당 멤버 동기화 삭제
- **멤버 저장 오류 무시 버그** — `supabase.update()` 에러를 체크하지 않아 실패해도 성공 처리되던 문제 수정
- **멤버 이름 변경 에러** — `rename_member_with_profile` RPC 미배포 시 직접 `members.update` fallback 처리
- **vsPointStore.syncMemberName 누락** — 멤버 이름 변경 시 VS 포인트 스토어 동기화 추가

### Changed
- 모바일에서 UID 컬럼 숨김 기준을 `sm` → `md` 로 변경

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
