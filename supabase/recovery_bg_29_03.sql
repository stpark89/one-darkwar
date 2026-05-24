-- =============================================
-- BLACK GOLD 29-03 데이터 복구 가이드
-- =============================================
-- 상황: BG/VS 가 war_rounds 공유하던 시기에 VS 회차 삭제로 cascade 발생
--       → war_rounds 의 29-03 행 + 해당 war_entries 행들이 모두 삭제됨
--
-- 복구 절차:
--   STEP A: 백업 프로젝트에서 데이터 추출 (SELECT)
--   STEP B: 추출한 데이터를 현재 프로젝트에 INSERT
--
-- ※ member_id 는 members 테이블 PK 로 양쪽 프로젝트가 동일해야 함.
--   (member 자체는 삭제된 적 없으면 OK)
-- ※ 시즌 29 가 현재 프로젝트에 존재해야 함 (없으면 먼저 seasons 에 INSERT)
-- =============================================


-- ============================================================
-- STEP A — 백업 프로젝트의 SQL Editor 에서 실행
-- ============================================================

-- A-1) 시즌 29 찾기 (이름은 "Season 29" / "29" / "29기" 등일 수 있음)
SELECT id, name, is_active, created_at
FROM seasons
WHERE name ILIKE '%29%'
ORDER BY created_at;

-- A-2) 시즌 29 의 모든 회차 보기 (sort_order 와 round_date 확인)
SELECT wr.id, wr.season_id, wr.sort_order, wr.round_date, wr.created_at, s.name as season_name
FROM war_rounds wr
JOIN seasons s ON s.id = wr.season_id
WHERE s.name ILIKE '%29%'
ORDER BY wr.sort_order;

-- A-3) "29-03" 회차 식별 → 보통 sort_order = 3 (또는 2 if 0-indexed).
--      해당 행의 id 를 메모 (예: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
--      ★ 아래 'PUT_ROUND_ID_HERE' 부분에 그 id 를 직접 넣어서 다음 쿼리 실행

-- A-4) 회차 행 자체를 INSERT 문 형태로 추출
SELECT format(
  'INSERT INTO war_rounds (id, season_id, sort_order, round_date, created_at) VALUES (%L, %L, %s, %L, %L);',
  id, season_id, sort_order, round_date, created_at
) AS insert_sql
FROM war_rounds
WHERE id = 'PUT_ROUND_ID_HERE';

-- A-5) 해당 회차의 war_entries 전체를 INSERT 문으로 추출
SELECT format(
  'INSERT INTO war_entries (id, round_id, member_id, team, role) VALUES (%L, %L, %L, %L, %L);',
  id, round_id, member_id, team, role
) AS insert_sql
FROM war_entries
WHERE round_id = 'PUT_ROUND_ID_HERE'
ORDER BY member_id;


-- ============================================================
-- STEP B — 현재 (운영) 프로젝트의 SQL Editor 에서 실행
-- ============================================================
-- A-4 / A-5 에서 나온 INSERT 문들을 순서대로 붙여넣고 실행.
-- 예시 형태:
--
--   INSERT INTO war_rounds (id, season_id, sort_order, round_date, created_at)
--   VALUES ('xxxx-...', 'season-uuid-...', 3, '2026-03-29', '2026-03-29 ...');
--
--   INSERT INTO war_entries (id, round_id, member_id, team, role) VALUES (...);
--   INSERT INTO war_entries (id, round_id, member_id, team, role) VALUES (...);
--   ... (멤버 수 만큼)
--
-- ※ season_id 가 현재 프로젝트에도 같은 UUID 로 존재해야 함.
--    다르면 INSERT 전에 현재 프로젝트의 season_id 로 치환.


-- ============================================================
-- 안전 점검 (STEP B 후 현재 프로젝트에서 실행)
-- ============================================================

-- B-1) 복구된 회차 확인
SELECT wr.id, wr.sort_order, wr.round_date, s.name as season_name,
       (SELECT count(*) FROM war_entries we WHERE we.round_id = wr.id) as entry_count
FROM war_rounds wr
JOIN seasons s ON s.id = wr.season_id
WHERE s.name ILIKE '%29%'
ORDER BY wr.sort_order;

-- B-2) 복구된 entries 샘플
SELECT we.team, we.role, m.in_game_name
FROM war_entries we
JOIN members m ON m.id = we.member_id
WHERE we.round_id = 'PUT_ROUND_ID_HERE'
ORDER BY we.team, we.role, m.in_game_name;
