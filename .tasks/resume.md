# Resume — ONE-DarkWar 재시작 진입점

## 📍 포인터

| 무엇을 알려면 | 어디를 읽나 |
|---|---|
| 프로젝트 규약(레이어·명명·검증) | `.claude/skills/conventions/SKILL.md` |
| 제품 목표 | `.tasks/product-goal.md` |
| **이주 시즌 분리 설계·되돌리기** | `.tasks/design/transfer-season.md` · `supabase/rollback_transfer_season.sql` |
| **미디어 표시 축소(왜 transform 인가)** | `src/lib/uploadMedia.ts` 머리 주석 + `4fa80f9` 커밋 메시지 |
| members↔profiles 연결 구조·배경 | `supabase/migration_member_profile_id.sql` (주석에 배경 전부) |
| 최근 변경 이유 | `git log` — 커밋 메시지에 근거·실측치를 적어둔다 |
| WebRTC·Presence 패턴 | Obsidian `기술-레퍼런스/WebRTC P2P 음성채팅 (Supabase Realtime 시그널링).md` |

## 지금 한 줄

새 시즌 이주를 열었고(게스트 모드·이주 메뉴·시즌 분리), 대시보드 이미지 로딩을
Storage image transform 으로 바꿨다. `HEAD 4fa80f9` 푸시 완료, SQL 3건 실행 완료.
미디어는 **실측으로 확인**했다(원본 3.2MB → 그리드 57KB · 56배).
**이주 관리자 화면과 UID 재조회는 아직 실물 검증이 안 됐다**(아래 1·2).

## 다음 1수

0. **홈을 열어 이미지 로딩 체감 확인** — 실측은 56배지만 화면에서 재지 않았다.
   배포 직후라 가장 싸게 확인된다. 안 빨라지면 원인이 크기가 아니라 다른 곳이다.
1. **관리자로 로그인해 SeasonBar 확인** — 새로 만든 UI 라 한 번도 눌러본 적이 없다.
   시즌 드롭다운·과거 시즌 열람·새 시즌 열기 3개. 이게 깨지면 시즌 운영이 막히므로 먼저.
2. **지난 시즌에 신청했던 UID 로 「내 신청 조회」** — 신규 신청 폼이 떠야 맞다.
   실데이터 UID 가 있어야 판별되므로 1번 다음. 구 신청이 뜨면 `get_my_transfer` 가 안 바뀐 것이다.
3. **새 시즌 등급·정원 조정** — 지난 시즌 값을 복제해 뒀다(GRAY 60 / Blue 20 / Purple 5 / Orange 1).
   조건이 달라진다고 했으니 기능이 아니라 **사용자 판단 대기**다.

## 룰북

**손대지 않을 것**
- `members.id` 를 auth 계정 id 로 쓰지 마라. **서로 다른 UUID 다**(실측: 95건 중 17건만 우연히 일치).
  계정 연결은 **`members.profile_id` (FK)** 로만 한다. 이름 매칭은 폴백일 뿐이다.
- `members` 가 길드원 명단의 **단일 기준**이다(사용자 확인). `profiles` 는 나간 사람 계정이 남아 있어
  그대로 세면 과다 집계된다. 반대로 계정 없는 멤버도 33명 있어 교집합만 취하면 과소 집계된다.
- 멤버 승인 화면은 `profiles` 기준이 **맞다** — 로그인 계정을 관리하는 곳이고 인원수를 표시하지 않는다.
- **신청 폼에 시즌 UI 를 넣지 마라**(사용자 확정). 시즌은 DB DEFAULT 로 자동 주입된다.

**반드시 할 것**
- **이미지를 화면에 넣을 땐 `displayUrl(url, 폭)` 을 거쳐라.** 원본은 3MB 가 넘는다.
  ⚠️ 이건 **Pro 플랜의 Storage image transform** 이다. 무료로 내려가면 깨진다.
  ⛔ 대신 「업로드 때 썸네일을 만들어 올리는」 방식으로 되돌리지 마라 —
  썸네일 업로드는 authenticated 전용인데 **게스트는 anon 이라 403** 이다(실측).
  게스트도 보는 화면에서는 영영 안 채워지고 403 요청만 쌓여 **더 느려졌다**(20.5s→41.1s).
- **Storage 업로드의 `cacheControl` 을 함부로 늘리지 마라** — 31536000 으로 올렸더니
  업로드가 400 으로 거부됐다(실측). 검증된 값은 `3600` 이다.
- **push 전 `npm run build`** (사용자 명시). `tsc --noEmit` 통과해도 빌드에서 깨진다.
- **이주 데이터를 새로 조회하는 코드에는 시즌 필터를 걸어라.** 안 걸면 지난 시즌이 섞여
  정원이 이미 찬 것처럼 보인다. INSERT 는 반대로 **건드리지 마라** — DB DEFAULT 가 알아서 넣는다.
- 시즌을 바꿀 땐 `transferStore`·`transferTierStore` 의 **`initialized` 를 false 로 리셋**해야 한다.
  캐시 가드가 있어 리셋 없이는 이전 시즌이 화면에 그대로 남는다.
- Supabase Presence 는 **`config.presence.key` 를 믿지 마라** — 적용 안 되는 경우가 있다(실측 2건:
  음성채팅·채팅). id 는 **`track()` 데이터에 담고** 거기서 읽는다.
- Realtime 채널명에 `Date.now()` 같은 가변값을 넣지 마라 — presence 가 topic 단위라 각자 고립된다.
- 멤버 추가·이름변경·삭제는 `warStore`·`eventStore`·`vsPointStore` 에 **전부 전파**해야 한다
  (각 스토어에 `initialized` 캐시 가드가 있어 새로고침 전까지 반영되지 않는다).
- 표 하단 합계행은 인원수가 **아니라** 참여자 수다. 전체 수와 나란히 보이면 문의가 들어온다 —
  라벨과 분모를 함께 표시한다.
