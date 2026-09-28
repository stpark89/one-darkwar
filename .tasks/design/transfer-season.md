# 설계 — 이주 신청 시즌 분리

> **상태:** 배포 완료 (2026-09-28 · `db1549d`) · SQL 실행 완료 · 결정자 사용자
>
> 실물 확인된 것: 게스트 진입 · 모집 현황 **전 등급 0명**(지난 시즌 안 섞임) · 신청 폼(시즌 UI 없음)
> 아직 안 본 것: **관리자 SeasonBar** · **지난 시즌 UID 재조회**

## 왜

새 시즌 이주가 열린다. 신청 조건(등급·정원)이 달라지는데 `transfer_applications` 에
시즌 구분이 없어, 지금 게스트를 열면 신규 신청이 지난 시즌 목록에 섞인다.

## 결정 (사용자 확정)

1. 시즌은 **데이터**다 — `transfer_seasons` 테이블 + 관리자 전환. 코드 상수 아님.
2. 화면은 **기본 현재 시즌만**. 과거 조회는 **관리자 전용**.
3. UID 재조회(`get_my_transfer`)는 **현재 시즌 건만** 찾는다. 없으면 신규 신청.
4. **신청 폼에 시즌 UI 를 넣지 않는다** — 시스템이 활성 시즌을 자동으로 붙인다.

## 어떻게 — 자동 주입을 DB DEFAULT 로

```sql
season_id uuid NOT NULL DEFAULT public.active_transfer_season()
```

⇒ INSERT 경로(단독 신청·단체 RPC·푸시 웹훅)는 **한 줄도 고치지 않는다.**
   클라이언트가 시즌을 모르므로 위조도 불가능하다. 고칠 곳은 **조회 경로뿐**이다.

활성 시즌은 **partial unique index** 로 하나만 존재하게 강제한다.

## 건드리는 것

| 층 | 대상 |
|---|---|
| DB | `transfer_seasons`(신규) · `transfer_applications.season_id` · `application_groups.season_id` · `transfer_tiers.season_id` |
| DB 함수 | `active_transfer_season()`(신규) · `get_my_transfer`(활성 시즌 필터 추가) |
| 스토어 | `transferStore`(조회 3곳) · `transferTierStore` · `transferSeasonStore`(신규) |
| 화면 | `RecruitmentWidget` · `TransferListPage` · `TransferGridPage` · `TransferPage`(관리자 시즌 UI) |

## 범위 밖

- 신청 폼(`TransferSubmitForm`) — 시즌 UI 없음이 결정사항이다
- 지난 시즌 데이터 삭제 — **보존**한다
- `update_my_transfer` — id 기반이라 시즌과 무관

## 단계

- **1단계(배포 필수)** — 스키마 + 자동 주입 + 조회를 **활성 시즌으로 고정**.
  이것만으로 신규/구 데이터가 갈린다. 내일 신청을 받으려면 여기까지가 최소다.
- **2단계** — 관리자 시즌 관리 UI. `SeasonBar.tsx` 로 구현 완료(배포됨, 실물 미검증).

## 끝났음을 증명할 검증

1. `npm run build` 통과
2. SQL 실행 후: 기존 신청 전건이 **지난 시즌**에 묶이고, 새 신청 1건이 **새 시즌**으로 들어간다
3. 게스트 모집 현황 위젯·신청 내역이 **새 시즌 건만** 센다
4. 지난 시즌에 신청했던 UID 로 조회 시 **신규 신청 폼**이 뜬다

## 되돌리기

`supabase/rollback_transfer_season.sql` — 컬럼 3개 DROP + 테이블 DROP.
데이터는 지우지 않으므로 컬럼만 빠지고 원상 복구된다.
