-- =============================================
-- 이미 신청된 이주 정보(transfer_applications)의 티켓 등급(tier_id)을
-- 현재 transfer_tiers(수정된 등급)의 CP 구간에 맞춰 재배정.
--
-- 매칭 규칙(앱 findTierForCp 와 동일):
--   min_cp <= CP(M) < max_cp     (max_cp 가 NULL 이면 상한 없음)
--   같은 CP 가 여러 구간에 걸리면 sort_order 가 빠른 등급 우선.
--
-- cp 컬럼은 "3.54G" / "282M" / "1500" 같은 텍스트 → M(메가) 단위로 환산:
--   G 또는 B 포함 = ×1000, 그 외 = ×1  (앱 parseCp 와 동일)
--
-- ※ 주의: tier_id 는 원래 신청자가 "직접 선택"한 값이다.
--   이 스크립트는 그 값을 CP(부대 전투력) 기준으로 다시 덮어쓴다.
--   반드시 1) 미리보기로 확인 후 2) UPDATE 실행할 것.
--
-- Supabase Dashboard → SQL Editor 에서 실행
-- =============================================


-- ── 공통 CTE: 각 신청서의 CP 를 M 단위로 환산하고 새 등급 매칭 ──────────
-- (미리보기 / UPDATE 양쪽에서 동일하게 사용)

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 1) 미리보기 — 변경될 행만 (현재 등급 → 새 등급) 확인                │
-- └─────────────────────────────────────────────────────────────────┘
WITH parsed AS (
  SELECT
    ta.id,
    ROUND(
      CASE
        WHEN regexp_replace(upper(COALESCE(ta.cp, '')), '[^0-9.]', '', 'g') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN regexp_replace(upper(ta.cp), '[^0-9.]', '', 'g')::numeric
        ELSE 0
      END
      * CASE WHEN upper(COALESCE(ta.cp, '')) ~ '[GB]' THEN 1000 ELSE 1 END
    )::int AS cp_mega
  FROM public.transfer_applications ta
),
matched AS (
  SELECT
    p.id,
    p.cp_mega,
    (SELECT tt.id
       FROM public.transfer_tiers tt
      WHERE p.cp_mega >= tt.min_cp
        AND (tt.max_cp IS NULL OR p.cp_mega < tt.max_cp)
      ORDER BY tt.sort_order ASC
      LIMIT 1) AS new_tier_id
  FROM parsed p
)
SELECT
  ta.in_game_name,
  ta.cp                       AS cp_raw,
  m.cp_mega                   AS cp_mega,
  cur.name                    AS current_tier,
  nw.name                     AS new_tier,
  ta.status
FROM public.transfer_applications ta
JOIN matched m              ON m.id = ta.id
LEFT JOIN public.transfer_tiers cur ON cur.id = ta.tier_id
LEFT JOIN public.transfer_tiers nw  ON nw.id  = m.new_tier_id
WHERE ta.tier_id IS DISTINCT FROM m.new_tier_id   -- 실제로 바뀌는 행만
ORDER BY m.cp_mega DESC;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2) 실제 업데이트 — 위 미리보기가 맞으면 아래만 따로 실행            │
-- └─────────────────────────────────────────────────────────────────┘
WITH parsed AS (
  SELECT
    ta.id,
    ROUND(
      CASE
        WHEN regexp_replace(upper(COALESCE(ta.cp, '')), '[^0-9.]', '', 'g') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN regexp_replace(upper(ta.cp), '[^0-9.]', '', 'g')::numeric
        ELSE 0
      END
      * CASE WHEN upper(COALESCE(ta.cp, '')) ~ '[GB]' THEN 1000 ELSE 1 END
    )::int AS cp_mega
  FROM public.transfer_applications ta
),
matched AS (
  SELECT
    p.id,
    (SELECT tt.id
       FROM public.transfer_tiers tt
      WHERE p.cp_mega >= tt.min_cp
        AND (tt.max_cp IS NULL OR p.cp_mega < tt.max_cp)
      ORDER BY tt.sort_order ASC
      LIMIT 1) AS new_tier_id
  FROM parsed p
)
UPDATE public.transfer_applications ta
SET tier_id = m.new_tier_id
FROM matched m
WHERE ta.id = m.id
  AND ta.tier_id IS DISTINCT FROM m.new_tier_id;   -- 바뀌는 행만 갱신


-- =============================================
-- 옵션 (필요 시 위 두 쿼리의 WHERE 절에 조건 추가)
--
--  · 대기중 신청만:           AND ta.status = 'PENDING'
--  · 등급 비어있는 행만:       AND ta.tier_id IS NULL
--  · CP 가 비어있는 행 제외:    AND COALESCE(ta.cp, '') <> ''
--  · 특정 시즌 등급으로만 매칭:  서브쿼리에 AND tt.season_name = '시즌명'
--
-- ※ transfer_tiers 에 여러 시즌(season_name)이 섞여 CP 구간이 겹치면
--   엉뚱한 등급이 매칭될 수 있다. 현재 시즌 등급만 남기거나
--   season_name 필터를 걸 것.
-- =============================================
