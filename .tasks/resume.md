# Resume — ONE-DarkWar 재시작 진입점

## 📍 포인터

| 무엇을 알려면 | 어디를 읽나 |
|---|---|
| 프로젝트 규약(레이어·명명·검증) | `.claude/skills/conventions/SKILL.md` · `CLAUDE.md` §3 다국어 |
| 이주 시즌 분리 설계·되돌리기 | `.tasks/design/transfer-season.md` · `supabase/rollback_transfer_season.sql` |
| 이벤트 날짜 교정·백업·복원 절차 | `supabase/fix_event_date_from_name.sql` |
| 291 홈 히어로 시안 → 구현 | `.tasks/design/server-home-hero.html` → `components/server/ServerHero.tsx` |
| 미디어 축소를 왜 transform 으로 했나 | `src/lib/uploadMedia.ts` 머리 주석 · 커밋 `4fa80f9` |
| 번역이 안 되던 원인 3개 | `src/lib/translate.ts` 주석 · 커밋 `8371067` · `d63be26`(같은 언어 → 무반응) |
| s7 시즌 사고·S2→s7 이관·되돌리기 | `supabase/fix_transfer_s2_to_s7_20261108.sql`(실행 완료) · 백업 `backup.*_20261108` |
| 하드코딩 한국어 → i18n 전수 교체 · 등급명 색 번역 | 커밋 `ac7e69d` · `src/lib/tierName.ts` · `b9b04ea` |
| 점령 순번 주차 날짜·주차 삭제 | 커밋 `4e3b5c0` · `supabase/migration_occupation_week_date.sql`(실행 완료) |
| 왜 네이티브 날짜 입력을 안 쓰나 | `components/ui/date-picker.tsx` 머리 주석 · 커밋 `0aefcc6` |
| members↔profiles 연결 구조·배경 | `supabase/migration_member_profile_id.sql` (주석에 배경 전부) |

## 지금 한 줄

11-08~10: 관리자가 「새 시즌」으로 s7 겨울이주를 열어 S2 신청이 「사라진」 것처럼 보임(삭제 아님, 로그로 확인).
사용자 결정으로 **S2 승인 41·대기 1·단체 3·등급 4 를 s7 로 이관**(백업 대비 변경 0건, 실측 SQL). 번역 무반응 수정 `d63be26`.

## 다음 1수

1. **s7 「31G」 신청자 전투력 확인** — 31M 오타면 통솔자 자리가 비고 중견 41/40 이 된다.
2. **관리자 계정으로 점령 순번 확인** — 기존 주차 날짜가 비어 「—」. 날짜 지정·주차 삭제·서버 일정 시각 저장을 실물로 본다.
3. **관리자 계정으로 베트남어 「이주 진행 현황」 확인** — 관리자 전용이라 렌더 미확인(키 해석만 확인).
4. **en/vi/zh-TW 등급명을 게임 공식 용어로 교체** — `tiers.name_*` 만 고치면 된다.

> 대기: 등급 전투력 구간 실제값(현재 175M~/80~175/40~80/0~40 임시) · 참여 횟수 운영 확인(0903 62명 누락 여부) ·
> `events_backup_260928` 문제없으면 DROP · eslint 기존 오류 26개(이번 변경 무관, 실측 11-08 HEAD 대조).

## 룰북

**손대지 않을 것**
- `members.id` 를 auth 계정 id 로 쓰지 마라. **서로 다른 UUID 다**. 연결은 **`members.profile_id`** 로만.
- `members` 가 길드원 명단의 **단일 기준**이다. 단 **멤버 승인 화면은 `profiles` 기준이 맞다**.
- **신청 폼에 시즌 UI 를 넣지 마라**(사용자 확정). 시즌은 DB DEFAULT 로 자동 주입된다.
- **썸네일을 직접 만들어 올리는 방식으로 되돌리지 마라** — 게스트는 anon 이라 403 이다(실측).
- **서버 홈에서 특정 동맹을 「우리」로 강조하지 마라** — 291 전체 소개 화면, 게스트·멤버 **같은 화면**(`3c9d20d`).
- **`<input type="date|datetime-local|time">` 금지** — OS 언어로 뜬다. `DatePicker`/`DateTimePicker` 를 쓴다.

**반드시 할 것**
- **push 전 `npm run build`** (사용자 명시). 배포는 **main 까지** 올리고 develop 도 같은 커밋으로 맞춘다.
- **작업 끝(커밋 2회+)이면 이 파일을 묻지 말고 갱신·커밋**한다(사용자 지적 11-08).
- **등급명은 `tierDisplayName(tier, t)`** 로 표시한다. `tier.name` 직접 출력은 관리자 편집 모드·수정 폼에서만.
- **비율의 분모에 「아직 안 채운 것」을 넣지 마라** — 분모는 **기록이 있는 것만** 센다(eventRate).
- **이벤트 이름은 `MMDD.이름`**. 날짜 기본값은 `todayLocal()` — `toISOString()` 은 UTC 라 하루 밀린다.
- 날짜 표시는 **`toLocale*(i18n.language, …)`**. 번역 API 에는 `normalizeLang()` 경유('ko-KR' 문제).
- 히어로의 신청 대기 수는 **`PENDING_SHOW_MIN`(5) 미만이면 숨긴다**.
- 이미지는 **`displayUrl(url, 폭)`** 경유. ⚠️ **Pro 플랜 transform** 의존. Storage **`cacheControl` 은 `3600`**.
- **「새 시즌 열기」는 등급표를 복사하지 않는다** — 열면 등급 0개. 단체(`application_groups`)도 시즌별이라 신청서만 옮기면 단체원이 안 그려진다.
- **이주 조회에는 시즌 필터**를 건다. INSERT 는 건드리지 마라(DB DEFAULT). 시즌 전환 시 두 스토어 **`initialized` 리셋**.
- Presence 는 **`config.presence.key` 를 믿지 마라** — id 는 `track()` 에 담아 읽는다.
- **등급 색은 `TIER_COLOR_CLASS` 외에 `TransferListPage` 자체 색 표가 하나 더 있다** — 색 추가 시 둘 다.
- **전체 조회는 1000행 한도를 의식한다** — 넘을 표는 `.range()` 페이지 조회(`fetchAllAttendance` 참고).
- 멤버 추가·이름변경·삭제는 `warStore`·`eventStore`·`vsPointStore` 에 **전부 전파**한다.
