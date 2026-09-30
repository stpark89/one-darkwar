# Resume — ONE-DarkWar 재시작 진입점

## 📍 포인터

| 무엇을 알려면 | 어디를 읽나 |
|---|---|
| 프로젝트 규약(레이어·명명·검증) | `.claude/skills/conventions/SKILL.md` |
| 이주 시즌 분리 설계·되돌리기 | `.tasks/design/transfer-season.md` · `supabase/rollback_transfer_season.sql` |
| 이벤트 날짜 교정·백업·복원 절차 | `supabase/fix_event_date_from_name.sql` |
| 291 홈 히어로 시안 → 구현 | `.tasks/design/server-home-hero.html` → `components/server/ServerHero.tsx` |
| 미디어 축소를 왜 transform 으로 했나 | `src/lib/uploadMedia.ts` 머리 주석 · 커밋 `4fa80f9` |
| 번역이 안 되던 원인 2개 | `src/lib/translate.ts` 머리 주석 · 커밋 `8371067` |
| members↔profiles 연결 구조·배경 | `supabase/migration_member_profile_id.sql` (주석에 배경 전부) |

## 지금 한 줄

`HEAD 318948d` — main·develop 같은 커밋, 운영 배포됨. 09-30 에 291 홈 히어로(「최강보단 최선을,」)와
동맹 목록 「우리 동맹」 배지 제거를 올렸다. 번역 수정·이미지 축소는 배포됐으나 **화면 확인 전**이다.
**09-29 「참여 횟수가 다 이상하다」 재제보가 미해결**이다(여러 명 연락).

## 다음 1수

1. **참여 횟수 재제보 확인** — 이벤트별 기록수를 09-28 값(86/86/84/80/86/85/84/78/87/77/74/78/85,
   event_date 순)과 비교. 같으면 표시 문제, 다르면 그 사이 저장·업로드가 있었다.
   ⚠️ `events_backup_260928` 에 attendance 는 **없다**. 실제 장애라 가장 먼저다.
2. **운영 화면 확인** — 히어로(폰 375) · 번역(외국어 글→한국어, 한국어 글→안내 토스트) · 이미지 속도.
   셋 다 배포만 됐고 사용자 화면에서 본 적이 없다. 한 번에 확인되므로 두 번째.
3. **관리자로 SeasonBar·지난 시즌 UID 조회 확인** — 눌러본 적이 없는 새 UI 다.

> 대기: 새 시즌 정원은 지난 시즌 복제값(60/20/5/1) · `events_backup_260928` 은 문제없으면 DROP ·
> 관리자 동맹 편집의 「우리 동맹」 체크박스는 이제 정렬에만 쓰인다(필요 없으면 제거).

## 룰북

**손대지 않을 것**
- `members.id` 를 auth 계정 id 로 쓰지 마라. **서로 다른 UUID 다**. 연결은 **`members.profile_id`** 로만.
- `members` 가 길드원 명단의 **단일 기준**이다. 단 **멤버 승인 화면은 `profiles` 기준이 맞다**.
- **신청 폼에 시즌 UI 를 넣지 마라**(사용자 확정). 시즌은 DB DEFAULT 로 자동 주입된다.
- **썸네일을 직접 만들어 올리는 방식으로 되돌리지 마라** — 게스트는 anon 이라 403 이다(실측).
- **서버 홈에서 특정 동맹을 「우리」로 강조하지 마라** — 291 전체 소개 화면이다(사용자 09-30).
  히어로·홈은 게스트·멤버 **같은 화면**이다(`3c9d20d` 결정 유지).

**반드시 할 것**
- **push 전 `npm run build`** (사용자 명시). 배포는 **main 까지** 올리고 develop 도 같은 커밋으로 맞춘다
  (09-30 develop 만 올렸다가 「main 에 합쳤어야」로 정정됨).
- **비율의 분모에 「아직 안 채운 것」을 넣지 마라** — 분모는 **기록이 있는 것만** 센다(eventRate).
- **이벤트 이름은 `MMDD.이름`**(`isValidEventName`). 목록·엑셀은 **`event_date` 순**. 날짜 기본값은
  `todayLocal()` — `toISOString()` 은 UTC 라 오전 9시 이전에 하루 전이 박힌다.
- 번역에 `i18n.language` 를 **그대로 넘기지 마라** — 'ko-KR' 이 와서 영어로 번역됐다. `normalizeLang()` 경유.
- 히어로의 신청 대기 수는 **`PENDING_SHOW_MIN`(5) 미만이면 숨긴다** — 적은 숫자는 역효과다.
- 이미지는 **`displayUrl(url, 폭)`** 경유. ⚠️ **Pro 플랜 transform** 의존 — 무료로 내려가면 느려진다.
- Storage **`cacheControl` 은 `3600`** — 31536000 은 업로드가 400 으로 거부됐다(실측).
- **이주 조회에는 시즌 필터**를 건다. INSERT 는 건드리지 마라(DB DEFAULT).
- 시즌 전환 시 `transferStore`·`transferTierStore` 의 **`initialized` 를 리셋**한다.
- Presence 는 **`config.presence.key` 를 믿지 마라** — id 는 `track()` 에 담아 읽는다.
- 멤버 추가·이름변경·삭제는 `warStore`·`eventStore`·`vsPointStore` 에 **전부 전파**한다.
