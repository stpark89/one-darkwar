-- =============================================
-- 티켓 등급에 색상 추가 + 기본 4개 등급 시드
--
-- 등급은 시즌마다 바뀌므로 관리자가 UI 에서 직접 수정 (이미 가능).
-- 여기서는 color 컬럼을 추가하고, 현재 시즌 기준 4개 등급을 넣는다.
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

-- 1) color 컬럼 추가 (orange / purple / blue / gray 중 하나)
ALTER TABLE public.transfer_tiers
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'gray';

-- 2) 기존 등급 데이터가 있으면 정리하고 새로 4개 시드.
--    ※ 이미 운영 중 등급이 있다면 이 DELETE 는 주의! 새로 세팅하는 경우만 실행.
--    안전을 위해 같은 이름이 있으면 건너뛰도록 ON CONFLICT 대신 조건부 INSERT.

-- CP 단위: M (메가). 282M, 138M, 84M.
INSERT INTO public.transfer_tiers (name, min_cp, max_cp, capacity, sort_order, season_name, color)
SELECT * FROM (VALUES
  ('Elite',     282, NULL::int, 0, 1, '', 'orange'),
  ('Advanced',  138, 282,       0, 2, '', 'purple'),
  ('Medium',    84,  138,       0, 3, '', 'blue'),
  ('Regular',   0,   84,        0, 4, '', 'gray')
) AS v(name, min_cp, max_cp, capacity, sort_order, season_name, color)
WHERE NOT EXISTS (SELECT 1 FROM public.transfer_tiers WHERE name = v.name);
