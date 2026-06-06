-- =============================================
-- 무기고 / 왕성 점령 순번 (291 서버 공용)
--
-- 동맹들이 번갈아 점령하는 순번을 관리. 특정 이벤트 시 한 곳이 연임할 수
-- 있으므로 고정 로테이션이 아니라 관리자가 자유롭게 순번을 편집한다.
--
-- 관리자만 편집, 누구나(게스트 포함) 조회.
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

CREATE TABLE IF NOT EXISTS public.occupation_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'armory'(무기고) | 'castle'(왕성)
  facility text NOT NULL CHECK (facility IN ('armory', 'castle')),
  alliance_name text NOT NULL,          -- 동맹명 (자유 입력 — ONE/NXO/NH-D 등)
  sort_order integer NOT NULL DEFAULT 0,
  is_current boolean NOT NULL DEFAULT false,  -- 현재 점령 차례
  note text NOT NULL DEFAULT '',         -- 연임 사유 / 일정 메모 등
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS occupation_turns_facility_idx
  ON public.occupation_turns(facility, sort_order);

ALTER TABLE public.occupation_turns ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 (게스트 포함 — 291 서버 공용 정보)
DROP POLICY IF EXISTS "occupation select all" ON public.occupation_turns;
CREATE POLICY "occupation select all" ON public.occupation_turns
  FOR SELECT USING (true);

-- 관리자만 INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "occupation insert admin" ON public.occupation_turns;
CREATE POLICY "occupation insert admin" ON public.occupation_turns
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "occupation update admin" ON public.occupation_turns;
CREATE POLICY "occupation update admin" ON public.occupation_turns
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "occupation delete admin" ON public.occupation_turns;
CREATE POLICY "occupation delete admin" ON public.occupation_turns
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ROLE_ADMIN')
  );
