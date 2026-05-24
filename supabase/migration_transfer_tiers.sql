-- 이주 신청 등급/정원 설정 (시즌별로 변경 가능)
-- min_cp / max_cp 는 M(메가) 단위 정수로 저장. 예: 5G = 5000, 3G = 3000.
-- max_cp 가 NULL 이면 상한 없음(예: 최상위 등급).

CREATE TABLE IF NOT EXISTS public.transfer_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_cp integer NOT NULL DEFAULT 0,
  max_cp integer,
  capacity integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  season_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transfer_tiers_sort_idx
  ON public.transfer_tiers(sort_order ASC);

ALTER TABLE public.transfer_tiers ENABLE ROW LEVEL SECURITY;

-- 누구나 SELECT (게스트가 신청할 때도 자기 등급을 미리 안내받을 수 있도록)
DROP POLICY IF EXISTS "tier select anyone" ON public.transfer_tiers;
CREATE POLICY "tier select anyone" ON public.transfer_tiers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "tier insert admin" ON public.transfer_tiers;
CREATE POLICY "tier insert admin" ON public.transfer_tiers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "tier update admin" ON public.transfer_tiers;
CREATE POLICY "tier update admin" ON public.transfer_tiers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "tier delete admin" ON public.transfer_tiers;
CREATE POLICY "tier delete admin" ON public.transfer_tiers
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ROLE_ADMIN')
  );
