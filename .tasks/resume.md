# Resume — ONE-DarkWar 재시작 진입점

## 📍 포인터

| 무엇을 알려면 | 어디를 읽나 |
|---|---|
| 프로젝트 규약(레이어·명명·검증) | `.claude/skills/conventions/SKILL.md` · `CLAUDE.md` §3 다국어 |
| 이주 시즌 분리 설계·되돌리기 | `.tasks/design/transfer-season.md` · `supabase/rollback_transfer_season.sql` |
| 이벤트 날짜 교정·백업·복원 절차 | `supabase/fix_event_date_from_name.sql` |
| 291 홈 히어로 시안 → 구현 | `.tasks/design/server-home-hero.html` → `components/server/ServerHero.tsx` |
| 미디어 축소를 왜 transform 으로 했나 | `src/lib/uploadMedia.ts` 머리 주석 · 커밋 `4fa80f9` |
| 번역이 안 되던 원인 2개 | `src/lib/translate.ts` 머리 주석 · 커밋 `8371067` |
| 하드코딩 한국어 → i18n 전수 교체(무엇을 남겼나) | 커밋 `ac7e69d` 본문 |
| 등급명을 색으로 번역하는 규칙 | `src/lib/tierName.ts` · 커밋 `b9b04ea` |
| members↔profiles 연결 구조·배경 | `supabase/migration_member_profile_id.sql` (주석에 배경 전부) |

## 지금 한 줄

main·develop 같은 커밋으로 운영 배포. 11-06: 「베트남어인데 한국어만 보인다」 → 하드코딩 한국어 24개 파일 i18n 교체(`ac7e69d`) ·
등급명을 DB 이름 대신 **색 기준 게임 등급**으로 표시(`b9b04ea`): 일반(회색) · 중급(파랑) · 고급(보라) · 특급(주황) · 통솔자(빨강).
S2 등급은 DB에 「중견」으로 저장돼 있으나 화면은 「중급」. 코드 리터럴 키 759개 4개 locale 대조 통과(실측: 11-06 스크립트).

## 다음 1수

1. **관리자 계정으로 베트남어 「이주 진행 현황」 확인** — 관리자 전용이라 로그인 못 해 화면 렌더 미확인(키 해석만 확인).
2. **en/vi/zh-TW 등급명을 게임 공식 용어로 교체** — 지금 임시 번역(Chỉ huy/Đặc cấp/Cao cấp/Trung cấp/Thường). `tiers.name_*` 만 고치면 된다.
3. **등급 전투력 구간 실제값 받기** — 게임은 이민 포인트 순위(1-12/13-45/46-225/226~), 사이트는 전투력 자동 분류.
   현재 구간(175M~ / 80~175 / 40~80 / 0~40)은 임시값. 실제 수치를 알면 관리자 화면에서 수정.

> 대기: 참여 횟수 운영 확인(0922=75 · 0926=85 · 합계 1133 · 실측 DB 10-01, 0903 62명 입력 누락 여부) ·
> `events_backup_260928` 은 문제없으면 DROP · 「우리 동맹」 체크박스는 정렬에만 쓰인다(필요 없으면 제거).

## 룰북

**손대지 않을 것**
- `members.id` 를 auth 계정 id 로 쓰지 마라. **서로 다른 UUID 다**. 연결은 **`members.profile_id`** 로만.
- `members` 가 길드원 명단의 **단일 기준**이다. 단 **멤버 승인 화면은 `profiles` 기준이 맞다**.
- **신청 폼에 시즌 UI 를 넣지 마라**(사용자 확정). 시즌은 DB DEFAULT 로 자동 주입된다.
- **썸네일을 직접 만들어 올리는 방식으로 되돌리지 마라** — 게스트는 anon 이라 403 이다(실측).
- **서버 홈에서 특정 동맹을 「우리」로 강조하지 마라** — 291 전체 소개 화면, 게스트·멤버 **같은 화면**(`3c9d20d`).

**반드시 할 것**
- **push 전 `npm run build`** (사용자 명시). 배포는 **main 까지** 올리고 develop 도 같은 커밋으로 맞춘다.
- **등급명은 `tierDisplayName(tier, t)`** 로 표시한다. `tier.name` 직접 출력은 관리자 편집 모드·수정 폼에서만.
- **비율의 분모에 「아직 안 채운 것」을 넣지 마라** — 분모는 **기록이 있는 것만** 센다(eventRate).
- **이벤트 이름은 `MMDD.이름`**(`isValidEventName`). 목록·엑셀은 **`event_date` 순**. 날짜 기본값은
  `todayLocal()` — `toISOString()` 은 UTC 라 오전 9시 이전에 하루 전이 박힌다.
- 번역에 `i18n.language` 를 **그대로 넘기지 마라** — 'ko-KR' 이 와서 영어로 번역됐다. `normalizeLang()` 경유.
- 히어로의 신청 대기 수는 **`PENDING_SHOW_MIN`(5) 미만이면 숨긴다** — 적은 숫자는 역효과다.
- 이미지는 **`displayUrl(url, 폭)`** 경유. ⚠️ **Pro 플랜 transform** 의존. Storage **`cacheControl` 은 `3600`**(31536000 은 400 거부).
- **이주 조회에는 시즌 필터**를 건다. INSERT 는 건드리지 마라(DB DEFAULT). 시즌 전환 시 두 스토어 **`initialized` 리셋**.
- Presence 는 **`config.presence.key` 를 믿지 마라** — id 는 `track()` 에 담아 읽는다.
- **등급 색은 `TIER_COLOR_CLASS` 외에 `TransferListPage` 자체 색 표가 하나 더 있다** — 색 추가 시 둘 다(+ `tierName.ts`).
- **전체 조회는 1000행 한도를 의식한다** — 넘을 표는 `.range()` 페이지 조회(`fetchAllAttendance` 참고). war_entries 가 차순위.
- 멤버 추가·이름변경·삭제는 `warStore`·`eventStore`·`vsPointStore` 에 **전부 전파**한다.
