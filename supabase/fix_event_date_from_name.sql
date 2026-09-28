-- =============================================
-- events.event_date 교정 — 이름에 적힌 날짜로 되돌린다 (1회성)
--
-- 배경: 이벤트 추가 폼의 날짜 기본값이 "오늘"이라, 과거 이벤트를 뒤늦게 등록할 때
--       날짜를 고치지 않으면 등록일이 박혔다. 실측(2026-09-28, 13건 중 8건):
--         0919.AT.III      event_date 2026-09-26 (등록일) ← 실제 09-19
--         0922.FactionClash event_date 2026-09-27 (등록일) ← 실제 09-22
--       목록 정렬이 created_at 이었던 것과 겹쳐, 과거 이벤트가 맨 뒤로 가고
--       엑셀 열 순서도 그래서 날짜순으로 착각한 칸에 값이 들어갔다.
--
-- 코드는 이미 고쳤다(정렬 event_date 기준 · 폼 기본값 로컬 날짜).
-- 이 스크립트는 **이미 틀어진 기존 행**만 이름 기준으로 되돌린다.
--
-- 이름 규칙 두 가지를 인식한다:
--   'MMDD.이름'  예: 0919.AT.III        → 09-19
--   'M/DD 이름'  예: 8/15 AT.IV         → 08-15
--   그 외 이름은 건드리지 않는다(NULL 로 계산되어 UPDATE 대상에서 빠진다).
-- 연도는 created_at 의 연도를 쓴다(현 데이터는 전부 2026).
--
-- ⚠️ 되돌리기 어렵다. 순서대로 실행한다:
--    0) 백업 → 1) 미리보기(눈으로 확인) → 2) UPDATE → (문제 시 3) 복원)
-- =============================================

-- ---------------------------------------------
-- 0) 백업 — UPDATE 전에 반드시 실행한다
-- ---------------------------------------------
-- CREATE TABLE public.events_backup_260928 AS SELECT * FROM public.events;

-- ---------------------------------------------
-- 1) 미리보기 — 무엇이 어떻게 바뀌는지 먼저 본다
-- ---------------------------------------------
WITH parsed AS (
  SELECT
    id,
    name,
    event_date AS before_date,
    CASE
      WHEN name ~ '^\d{4}\.' THEN
        to_date(
          extract(year from created_at)::text || substring(name, 1, 4),
          'YYYYMMDD'
        )
      WHEN name ~ '^\d{1,2}/\d{1,2}' THEN
        to_date(
          extract(year from created_at)::text
            || lpad(split_part(split_part(name, ' ', 1), '/', 1), 2, '0')
            || lpad(split_part(split_part(name, ' ', 1), '/', 2), 2, '0'),
          'YYYYMMDD'
        )
      ELSE NULL
    END AS after_date
  FROM public.events
)
SELECT
  name,
  before_date,
  after_date,
  CASE
    WHEN after_date IS NULL THEN '건너뜀 (이름에 날짜 없음)'
    WHEN after_date = before_date THEN '변경 없음'
    ELSE '교정'
  END AS action
FROM parsed
ORDER BY after_date NULLS LAST, name;

-- ---------------------------------------------
-- 2) 실제 교정 — 위 미리보기를 확인한 뒤에만 실행한다
-- ---------------------------------------------
-- UPDATE public.events e
-- SET event_date = p.after_date
-- FROM (
--   SELECT
--     id,
--     CASE
--       WHEN name ~ '^\d{4}\.' THEN
--         to_date(extract(year from created_at)::text || substring(name, 1, 4), 'YYYYMMDD')
--       WHEN name ~ '^\d{1,2}/\d{1,2}' THEN
--         to_date(
--           extract(year from created_at)::text
--             || lpad(split_part(split_part(name, ' ', 1), '/', 1), 2, '0')
--             || lpad(split_part(split_part(name, ' ', 1), '/', 2), 2, '0'),
--           'YYYYMMDD'
--         )
--       ELSE NULL
--     END AS after_date
--   FROM public.events
-- ) p
-- WHERE e.id = p.id
--   AND p.after_date IS NOT NULL
--   AND p.after_date IS DISTINCT FROM e.event_date;

-- ---------------------------------------------
-- 3) 복원 — 결과가 잘못됐을 때만
--    event_date 만 되돌린다. 백업 후 추가된 이벤트는 건드리지 않는다.
-- ---------------------------------------------
-- UPDATE public.events e
-- SET event_date = b.event_date
-- FROM public.events_backup_260928 b
-- WHERE e.id = b.id;

-- ---------------------------------------------
-- 4) 정리 — 며칠 지켜보고 문제없을 때
-- ---------------------------------------------
-- DROP TABLE public.events_backup_260928;
