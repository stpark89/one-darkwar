-- =============================================
-- 티켓 등급 정리: 예전 등급 삭제 + 새 4개만 유지 + 신청서 등급 재배정
--
-- 현재 transfer_tiers 에 옛 등급 + 새 등급이 섞여 8개가 됨.
-- 새로 추가된 4개(Elite / Advanced / Medium / Regular)만 남기고 삭제한다.
-- (transfer_applications.tier_id 는 ON DELETE SET NULL → 삭제 시 자동 NULL)
--
-- ※ 반드시 1) 확인 → 2) 삭제 → 3) 재배정 순서로 실행.
--   2) 삭제 전에 1)에서 남길 4개 이름이 정확한지 확인할 것.
--
-- Supabase Dashboard → SQL Editor 에서 실행
-- =============================================


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 1) 확인 — 현재 등록된 모든 등급                                     │
-- └─────────────────────────────────────────────────────────────────┘
SELECT id, name, min_cp, max_cp, color, sort_order, season_name, created_at
FROM public.transfer_tiers
ORDER BY created_at;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2) 삭제 — 새 4개(이름 기준, 동명이면 최신 1개)만 남기고 전부 삭제   │
-- │    ※ 위 1) 결과에서 남길 4개 이름이 아래와 다르면 이름을 맞춰 수정   │
-- └─────────────────────────────────────────────────────────────────┘
DELETE FROM public.transfer_tiers
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM public.transfer_tiers
  WHERE name IN ('Elite', 'Advanced', 'Medium', 'Regular')
  ORDER BY name, created_at DESC
);

-- (대안) 위 이름 방식이 안 맞으면, 1)에서 확인한 "삭제할 옛 등급" id 를 직접 지정:
-- DELETE FROM public.transfer_tiers WHERE id IN ('옛id1', '옛id2', ...);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 3) 재배정 — 신청서 tier_id 를 남은 등급의 CP 구간에 맞춰 다시 매칭   │
-- │    (min_cp <= CP(M) < max_cp, max_cp NULL 이면 상한 없음)           │
-- │    cp 텍스트 → M 환산: G/B = ×1000 (1G = 1000M)                     │
-- └─────────────────────────────────────────────────────────────────┘
WITH parsed AS (
  SELECT
    ta.id,
    ROUND(
      CASE
        -- "3G45" / "3B45": G/B 가 소수점 역할 → 3.45G = 3450M
        WHEN upper(COALESCE(ta.cp, '')) ~ '^[0-9]+[GB][0-9]+$'
          THEN regexp_replace(upper(ta.cp), '^([0-9]+)[GB]([0-9]+)$', '\1.\2')::numeric * 1000
        -- 일반 숫자 (+ 선택적 G/B/M 단위)
        WHEN regexp_replace(upper(COALESCE(ta.cp, '')), '[^0-9.]', '', 'g') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN regexp_replace(upper(ta.cp), '[^0-9.]', '', 'g')::numeric
               * CASE WHEN upper(ta.cp) ~ '[GB]' THEN 1000 ELSE 1 END
        ELSE 0
      END
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
  AND ta.tier_id IS DISTINCT FROM m.new_tier_id;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 4) (선택) 결과 확인 — 등급별 신청 인원                              │
-- └─────────────────────────────────────────────────────────────────┘
-- SELECT tt.name, count(ta.id) AS apps
-- FROM public.transfer_tiers tt
-- LEFT JOIN public.transfer_applications ta ON ta.tier_id = tt.id
-- GROUP BY tt.name ORDER BY tt.sort_order;
