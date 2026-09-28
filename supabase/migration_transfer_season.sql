-- =============================================
-- 이주 신청 시즌 분리
--
-- 배경: 시즌마다 이주 신청 조건(등급·정원)이 달라지는데 신청서에 시즌 구분이
--       없어, 새 시즌 신청이 지난 시즌 목록에 섞인다.
--
-- 설계: 활성 시즌을 DB DEFAULT 로 자동 주입한다. 신청 INSERT 경로(단독 신청·
--       단체 RPC·푸시 웹훅)는 한 줄도 고치지 않는다. 클라이언트는 시즌을
--       모르므로 위조도 불가능하다. 고치는 것은 조회 경로뿐이다.
--
-- 설계 문서: .tasks/design/transfer-season.md
-- 되돌리기: supabase/rollback_transfer_season.sql
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

-- ---------------------------------------------
-- 1) 시즌 테이블
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.transfer_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  -- 신청을 받는 시즌. 아래 partial unique index 로 동시에 하나만 존재한다.
  is_active boolean NOT NULL DEFAULT false,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 활성 시즌은 최대 1개 — 두 시즌이 동시에 열려 신청이 갈라지는 것을 DB 가 막는다
CREATE UNIQUE INDEX IF NOT EXISTS transfer_seasons_one_active_idx
  ON public.transfer_seasons(is_active) WHERE is_active;

CREATE INDEX IF NOT EXISTS transfer_seasons_sort_idx
  ON public.transfer_seasons(sort_order DESC, created_at DESC);

ALTER TABLE public.transfer_seasons ENABLE ROW LEVEL SECURITY;

-- 누구나 SELECT (게스트도 현재 시즌 이름·기간을 본다)
DROP POLICY IF EXISTS "season select anyone" ON public.transfer_seasons;
CREATE POLICY "season select anyone" ON public.transfer_seasons
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "season insert admin" ON public.transfer_seasons;
CREATE POLICY "season insert admin" ON public.transfer_seasons
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "season update admin" ON public.transfer_seasons;
CREATE POLICY "season update admin" ON public.transfer_seasons
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "season delete admin" ON public.transfer_seasons;
CREATE POLICY "season delete admin" ON public.transfer_seasons
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ROLE_ADMIN')
  );

-- ---------------------------------------------
-- 2) 활성 시즌 조회 함수 (DEFAULT 로 쓰이므로 STABLE)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.active_transfer_season()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.transfer_seasons WHERE is_active LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.active_transfer_season() TO anon, authenticated;

-- ---------------------------------------------
-- 3) 시즌 시드 — 지난 시즌(기존 데이터 귀속) + 새 시즌(활성)
-- ---------------------------------------------
INSERT INTO public.transfer_seasons (name, is_active, sort_order, closed_at)
SELECT 'S1 (지난 이주)', false, 1, now()
WHERE NOT EXISTS (SELECT 1 FROM public.transfer_seasons WHERE sort_order = 1);

INSERT INTO public.transfer_seasons (name, is_active, sort_order)
SELECT 'S2 (신규 이주)', true, 2
WHERE NOT EXISTS (SELECT 1 FROM public.transfer_seasons WHERE sort_order = 2);

-- ---------------------------------------------
-- 4) 기존 테이블에 season_id 추가 + 기존 데이터를 지난 시즌으로 백필
--    (컬럼을 먼저 NULL 허용으로 붙이고 → 백필 → DEFAULT 부여 순서.
--     DEFAULT 를 먼저 주면 기존 행까지 새 시즌으로 들어간다.)
-- ---------------------------------------------
ALTER TABLE public.transfer_applications ADD COLUMN IF NOT EXISTS season_id uuid
  REFERENCES public.transfer_seasons(id) ON DELETE SET NULL;
ALTER TABLE public.application_groups ADD COLUMN IF NOT EXISTS season_id uuid
  REFERENCES public.transfer_seasons(id) ON DELETE SET NULL;
ALTER TABLE public.transfer_tiers ADD COLUMN IF NOT EXISTS season_id uuid
  REFERENCES public.transfer_seasons(id) ON DELETE SET NULL;

UPDATE public.transfer_applications SET season_id =
  (SELECT id FROM public.transfer_seasons WHERE sort_order = 1)
  WHERE season_id IS NULL;
UPDATE public.application_groups SET season_id =
  (SELECT id FROM public.transfer_seasons WHERE sort_order = 1)
  WHERE season_id IS NULL;
UPDATE public.transfer_tiers SET season_id =
  (SELECT id FROM public.transfer_seasons WHERE sort_order = 1)
  WHERE season_id IS NULL;

-- 이제부터 들어오는 행은 활성 시즌으로 자동 귀속된다
ALTER TABLE public.transfer_applications
  ALTER COLUMN season_id SET DEFAULT public.active_transfer_season();
ALTER TABLE public.application_groups
  ALTER COLUMN season_id SET DEFAULT public.active_transfer_season();
ALTER TABLE public.transfer_tiers
  ALTER COLUMN season_id SET DEFAULT public.active_transfer_season();

CREATE INDEX IF NOT EXISTS transfer_applications_season_idx
  ON public.transfer_applications(season_id, created_at DESC);
CREATE INDEX IF NOT EXISTS application_groups_season_idx
  ON public.application_groups(season_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transfer_tiers_season_idx
  ON public.transfer_tiers(season_id, sort_order ASC);

-- ---------------------------------------------
-- 5) 새 시즌 등급표 시드 — 지난 시즌 등급을 복제한다
--    복제하지 않으면 새 시즌에 등급이 0개라 신청 폼에서 등급을 못 고른다.
--    조건이 달라지면 관리자가 화면에서 수정한다.
-- ---------------------------------------------
INSERT INTO public.transfer_tiers (name, min_cp, max_cp, capacity, sort_order, season_name, season_id)
SELECT t.name, t.min_cp, t.max_cp, t.capacity, t.sort_order, t.season_name,
       (SELECT id FROM public.transfer_seasons WHERE sort_order = 2)
FROM public.transfer_tiers t
WHERE t.season_id = (SELECT id FROM public.transfer_seasons WHERE sort_order = 1)
  AND NOT EXISTS (
    SELECT 1 FROM public.transfer_tiers n
    WHERE n.season_id = (SELECT id FROM public.transfer_seasons WHERE sort_order = 2)
  );

-- ---------------------------------------------
-- 6) UID 조회 RPC — 활성 시즌 건만 찾는다
--    지난 시즌에 신청했던 사람이 같은 UID 로 들어오면 결과가 없어야
--    신규 신청 폼이 뜬다 (사용자 확정).
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_transfer(p_name text, p_uid text)
RETURNS SETOF public.transfer_applications
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- UID 매칭만으로 조회. p_name 은 무시 (시그니처 호환).
  -- p_uid 비어있으면 결과 없음 (보안: 빈 인자로 전체 노출 금지)
  SELECT *
  FROM public.transfer_applications
  WHERE TRIM(uid) = TRIM(p_uid)
    AND TRIM(p_uid) <> ''
    AND season_id = public.active_transfer_season()
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_transfer(text, text) TO anon, authenticated;
