# 이주 신청 v2 — 단체 신청 + 동맹 선택 + 게스트 조회

## 변경 요약

1. **희망 동맹 필드** — ONE / NXO / NH-D / 기타
2. **단체 신청** — 대표자가 N명 정보를 한 폼에서 일괄 등록
3. **이주 신청 내역 페이지** — 게스트도 조회 가능 (대기·승인만)

## 1. 마이그레이션 실행 (필수)

Supabase Dashboard → SQL Editor 에서:

```
supabase/migration_transfer_v2_groups.sql
```

내용:
- `application_groups` 테이블 신설 (대표자 정보 + 희망 동맹)
- `transfer_applications` 에 컬럼 추가: `group_id`, `desired_alliance`, `desired_alliance_other`
- **기존 신청 데이터(10건+)는 desired_alliance='ONE' 으로 기본 backfill** — 다른 동맹으로 가는 거였으면 SQL Editor 에서 UPDATE 필요
- 게스트 조회용 RLS — `status IN (PENDING, APPROVED)` 만 anon SELECT 허용 (거절은 자동 숨김)
- `submit_transfer_group` RPC — 그룹+멤버 한 트랜잭션 INSERT

## 2. 동작

### 게스트 사이드바
- **이주 신청** → 본인/단체 토글 폼
- **이주 신청 내역** (NEW) → 동맹별 필터, 그룹 펼침 보기

### 신청 폼 — 단체 모드
1. "단체" 토글 선택
2. 대표자 정보 입력 (이름 / UID / Zalo)
3. 희망 동맹 선택
4. 멤버 리스트:
   - 1행은 자동으로 대표자 (이름/UID readOnly)
   - "멤버 추가" 버튼으로 동적 행 추가
5. 제출 → RPC 가 그룹 + N개 신청 한 번에 INSERT

### 게스트 조회 페이지 (`/transfer/list`)
- 동맹 필터 칩 (ALL / ONE / NXO / NH-D / 기타)
- 단체 카드 (펼치면 멤버 N명)
- 단독 카드 (개별 표시)
- 거절은 표시 안 됨 (RLS 차단)
- 관리자 메시지(admin_message) 비공개

### 관리자 화면
- 카드에 **희망 동맹 배지** + **단체 배지** 표시
- 동맹별 필터 칩 추가 (검색 필터 옆)
- 동맹별 신청자 수 카운트

## 3. 기존 데이터 정리 (선택)

기존 신청자 중 ONE 이 아닌 다른 동맹 신청이 있었다면:

```sql
UPDATE public.transfer_applications
SET desired_alliance = 'NXO'   -- 또는 NH_D, OTHER
WHERE id IN ('아이디1', '아이디2', ...);
```

## 4. 트러블슈팅

- **단체 신청 시 RPC 호출 실패**: 마이그레이션 미실행 가능성. SQL Editor 에서 마이그레이션 다시 실행
- **조회 페이지가 비어있음**: RLS 정책이 올바르게 적용됐는지 확인. status 가 PENDING/APPROVED 인 행만 anon 에 노출됨
- **거절된 신청이 보임**: 안 보여야 정상. 보인다면 RLS 정책 누락된 것
- **희망 동맹 필터가 안 먹힘**: 기존 데이터의 `desired_alliance` 값이 NULL 이면 보이지 않을 수 있음. backfill 확인
