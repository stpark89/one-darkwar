# Resume — ONE-DarkWar 재시작 진입점

## 📍 포인터

| 무엇을 알려면 | 어디를 읽나 |
|---|---|
| 프로젝트 규약(레이어·명명·검증) | `.claude/skills/conventions/SKILL.md` |
| 제품 목표 | `.tasks/product-goal.md` |
| 이주 시즌 분리 설계·되돌리기 | `.tasks/design/transfer-season.md` · `supabase/rollback_transfer_season.sql` |
| 미디어 축소를 왜 transform 으로 했나 | `src/lib/uploadMedia.ts` 머리 주석 · 커밋 `4fa80f9` |
| members↔profiles 연결 구조·배경 | `supabase/migration_member_profile_id.sql` (주석에 배경 전부) |
| WebRTC·Presence 패턴 | Obsidian `기술-레퍼런스/WebRTC P2P 음성채팅 (Supabase Realtime 시그널링).md` |

## 지금 한 줄

새 시즌 이주(게스트 모드·메뉴·시즌 분리)와 이미지 축소(transform, 3.2MB→57KB 실측)를
배포했다. 둘 다 **화면 체감은 미검증**이다.
길드원 제보(09-28) 「이벤트 추가 시 수치 틀어짐」 **해결**: 진짜 원인은 폼 날짜 기본값이
「오늘」이라 과거 이벤트에 등록일이 박힌 것 + 목록 정렬이 created_at 이었던 것이다.
코드 배포 + DB 7건 교정 완료. 참석 기록은 유실 없음(전 이벤트 74~87건 고름).

## 다음 1수

1. **홈·이벤트 화면 한 번 열기** — 출석률·이미지·이벤트 정렬 3건이 전부 같은 동선에서
   확인된다. 전부 배포됐지만 **화면에서 본 적이 없다**. 가장 싸게 한 번에 검증된다.
2. **관리자로 SeasonBar·지난 시즌 UID 조회 확인** — 새로 만든 UI 라 눌러본 적이 없다.
   이게 깨지면 시즌 운영이 막히므로 이주 쪽에서는 최우선.
3. **`events_backup_260928` 정리** — 며칠 지켜보고 문제없으면 DROP.
   절차는 `supabase/fix_event_date_from_name.sql` §4.

> 대기 중(사용자 판단): 새 시즌 등급·정원은 지난 시즌 값 복제 상태다(GRAY 60/Blue 20/Purple 5/Orange 1).

## 룰북

**손대지 않을 것**
- `members.id` 를 auth 계정 id 로 쓰지 마라. **서로 다른 UUID 다**(실측: 95건 중 17건만 일치).
  계정 연결은 **`members.profile_id` (FK)** 로만 한다. 이름 매칭은 폴백일 뿐이다.
- `members` 가 길드원 명단의 **단일 기준**이다. `profiles` 로 세면 나간 사람이 섞여 과다,
  교집합만 취하면 계정 없는 멤버 33명이 빠져 과소 집계된다.
  단 **멤버 승인 화면은 `profiles` 기준이 맞다** — 로그인 계정을 관리하는 곳이다.
- **신청 폼에 시즌 UI 를 넣지 마라**(사용자 확정). 시즌은 DB DEFAULT 로 자동 주입된다.
- **업로드 때 썸네일을 만들어 올리는 방식으로 되돌리지 마라** — 썸네일 업로드는
  authenticated 전용인데 **게스트는 anon 이라 403** 이다(실측). 게스트도 보는 화면이라
  영영 안 채워지고 403 요청만 쌓여 오히려 느려졌다(20.5s→41.1s).

**반드시 할 것**
- **push 전 `npm run build`** (사용자 명시). `tsc --noEmit` 통과해도 빌드에서 깨진다.
- **비율의 분모에 「아직 안 채운 것」을 넣지 마라** — 운영은 이벤트를 먼저 만들고 나중에
  참석 정보를 올린다. 분모는 **기록이 있는 것만** 센다(`HomePage.tsx` eventRate).
- **이벤트는 `event_date` 순으로 다뤄라**(`created_at` 아님). 과거 이벤트를 뒤늦게 등록하면
  목록·엑셀 열이 뒤로 밀려 엉뚱한 칸에 값이 들어간다. 날짜 기본값은 `todayLocal()` —
  `toISOString()` 은 UTC 라 오전 9시 이전에 하루 전이 박힌다.
- 이미지를 화면에 넣을 땐 **`displayUrl(url, 폭)`** 을 거쳐라. 원본은 3MB 가 넘는다.
  ⚠️ **Pro 플랜의 Storage image transform** 에 의존한다 — 무료로 내려가면 깨진다.
- Storage 업로드의 **`cacheControl` 을 함부로 늘리지 마라** — 31536000 으로 올렸더니
  업로드가 400 으로 거부됐다(실측). 검증된 값은 `3600` 이다.
- **이주 조회 코드에는 시즌 필터를 걸어라.** 안 걸면 지난 시즌이 섞여 정원이 찬 것처럼
  보인다. INSERT 는 반대로 **건드리지 마라** — DB DEFAULT 가 넣는다.
- 시즌을 바꿀 땐 `transferStore`·`transferTierStore` 의 **`initialized` 를 리셋**해야 한다.
  캐시 가드가 있어 리셋 없이는 이전 시즌이 화면에 남는다.
- Presence 는 **`config.presence.key` 를 믿지 마라**(실측 2건) — id 는 `track()` 에 담아 읽는다.
  채널명에 `Date.now()` 를 넣지 마라(topic 단위라 각자 고립된다).
- 멤버 추가·이름변경·삭제는 `warStore`·`eventStore`·`vsPointStore` 에 **전부 전파**한다.
- 표 하단 합계행은 인원수가 **아니라** 참여자 수다 — 라벨과 분모를 함께 표시한다.
