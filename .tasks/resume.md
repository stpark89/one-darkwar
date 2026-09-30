# Resume — ONE-DarkWar 재시작 진입점

## 📍 포인터

| 무엇을 알려면 | 어디를 읽나 |
|---|---|
| 프로젝트 규약(레이어·명명·검증) | `.claude/skills/conventions/SKILL.md` |
| 제품 목표 | `.tasks/product-goal.md` |
| 이주 시즌 분리 설계·되돌리기 | `.tasks/design/transfer-season.md` · `supabase/rollback_transfer_season.sql` |
| 이벤트 날짜 교정·백업·복원 절차 | `supabase/fix_event_date_from_name.sql` |
| 291 홈 히어로 시안(사용자 OK) | `.tasks/design/server-home-hero.html` — 브라우저로 연다 |
| 미디어 축소를 왜 transform 으로 했나 | `src/lib/uploadMedia.ts` 머리 주석 · 커밋 `4fa80f9` |
| members↔profiles 연결 구조·배경 | `supabase/migration_member_profile_id.sql` (주석에 배경 전부) |

## 지금 한 줄

새 시즌 이주(게스트 모드·메뉴·시즌 분리)와 이미지 축소(transform, 3.2MB→57KB 실측)를
배포했다. 둘 다 **화면 체감은 미검증**이다.
이벤트 날짜 꼬임은 해결했으나 **09-29 「참여 횟수가 다 이상하다」 재제보**가 미해결이다.
291 홈 히어로 시안은 사용자가 방향 OK(09-30) — 문구 확정 후 개발한다.

## 다음 1수

1. **참여 횟수 재제보 확인** — 이벤트별 기록수를 09-28 값(86/86/84/80/86/85/84/78/87/77/74/78/85,
   event_date 순)과 비교. ⚠️ 백업에 attendance 는 없다. 여러 명이 연락한 실제 장애라 먼저다.
2. **291 홈 히어로 개발** — 시안대로 `ServerHomePage` 헤더를 **교체**(추가 아님). 개발 전 확정:
   **전부 확정**: 문구·배치는 시안 그대로 · 숫자는 남은 자리 + 신청 대기(PENDING 수, **5명 미만이면 숨김**,
   상수로) · 게스트·멤버 **모두** 노출(`3c9d20d` 화면 일치 결정 유지). 시안의 12명은 자리표시값.
   기존 큰 「이주 신청하기」 버튼은 뺀다(진입점 중복).
3. **관리자로 SeasonBar·지난 시즌 UID 조회 확인** — 새로 만든 UI 라 눌러본 적이 없다.

> 대기: 새 시즌 정원은 지난 시즌 복제값(60/20/5/1) · `events_backup_260928` 은 문제없으면 DROP.
## 룰북

**손대지 않을 것**
- `members.id` 를 auth 계정 id 로 쓰지 마라. **서로 다른 UUID 다**(실측: 95건 중 17건만 일치).
  계정 연결은 **`members.profile_id` (FK)** 로만 한다. 이름 매칭은 폴백일 뿐이다.
- `members` 가 길드원 명단의 **단일 기준**이다(`profiles` 는 과다, 교집합은 과소 집계).
  단 **멤버 승인 화면은 `profiles` 기준이 맞다** — 로그인 계정을 관리하는 곳이다.
- **신청 폼에 시즌 UI 를 넣지 마라**(사용자 확정). 시즌은 DB DEFAULT 로 자동 주입된다.
- **업로드 때 썸네일을 만들어 올리는 방식으로 되돌리지 마라** — 썸네일 업로드는
  authenticated 전용인데 **게스트는 anon 이라 403** 이다(실측). 영영 안 채워지고 더 느려졌다.

**반드시 할 것**
- **push 전 `npm run build`** (사용자 명시). `tsc --noEmit` 통과해도 빌드에서 깨진다.
- **비율의 분모에 「아직 안 채운 것」을 넣지 마라** — 운영은 이벤트를 먼저 만들고 나중에
  참석 정보를 올린다. 분모는 **기록이 있는 것만** 센다(`HomePage.tsx` eventRate).
- **이벤트 이름은 `MMDD.이름`** 이 규칙이다(`isValidEventName`). 날짜는 이름에서 자동으로
  채워지고, 목록·엑셀은 **`event_date` 순**이다(`created_at` 아님).
  ⛔ placeholder·힌트를 옛 형식으로 되돌리지 마라 — 담당자는 그걸 보고 적는다(실제 원인이었다).
  날짜 기본값은 `todayLocal()` — `toISOString()` 은 UTC 라 오전 9시 이전에 하루 전이 박힌다.
- 이미지를 화면에 넣을 땐 **`displayUrl(url, 폭)`** 을 거쳐라. 원본은 3MB 가 넘는다.
  ⚠️ **Pro 플랜의 Storage image transform** 에 의존한다 — 무료로 내려가면 깨진다.
- Storage 업로드의 **`cacheControl` 을 함부로 늘리지 마라** — 31536000 으로 올렸더니
  업로드가 400 으로 거부됐다(실측). 검증된 값은 `3600` 이다.
- **이주 조회 코드에는 시즌 필터를 걸어라.** 안 걸면 지난 시즌이 섞여 정원이 찬 것처럼
  보인다. INSERT 는 반대로 **건드리지 마라** — DB DEFAULT 가 넣는다.
- 시즌을 바꿀 땐 `transferStore`·`transferTierStore` 의 **`initialized` 를 리셋**한다(캐시 가드).
- Presence 는 **`config.presence.key` 를 믿지 마라**(실측 2건) — id 는 `track()` 에 담아 읽는다.
- 멤버 추가·이름변경·삭제는 `warStore`·`eventStore`·`vsPointStore` 에 **전부 전파**한다.
