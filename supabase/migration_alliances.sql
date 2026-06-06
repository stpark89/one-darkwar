-- =============================================
-- 291 서버 동맹 목록 (세력도 / 외교)
--
-- 서버 주요 동맹의 약칭·모집 여부·연락처를 정리. 이주 희망자가 동맹을
-- 고를 때 참고하고, 동맹 간 소통 창구로도 사용.
-- 관리자만 편집, 누구나(게스트 포함) 조회.
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

CREATE TABLE IF NOT EXISTS public.alliances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                       -- 동맹 전체 이름
  tag text NOT NULL DEFAULT '',             -- 약칭 (ONE / NXO / NH-D)
  recruiting boolean NOT NULL DEFAULT false, -- 모집 중 여부
  contact text NOT NULL DEFAULT '',         -- 디스코드/연락처
  note text NOT NULL DEFAULT '',            -- 소개/비고
  is_home boolean NOT NULL DEFAULT false,   -- 우리 동맹(ONE) 강조용
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alliances_sort_idx
  ON public.alliances(sort_order ASC);

ALTER TABLE public.alliances ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 (게스트 포함)
DROP POLICY IF EXISTS "alliances select all" ON public.alliances;
CREATE POLICY "alliances select all" ON public.alliances
  FOR SELECT USING (true);

-- 관리자만 INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "alliances insert admin" ON public.alliances;
CREATE POLICY "alliances insert admin" ON public.alliances
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "alliances update admin" ON public.alliances;
CREATE POLICY "alliances update admin" ON public.alliances
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "alliances delete admin" ON public.alliances;
CREATE POLICY "alliances delete admin" ON public.alliances
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ROLE_ADMIN')
  );

-- (선택) 우리 동맹 ONE 시드 — 이미 있으면 건너뜀
INSERT INTO public.alliances (name, tag, recruiting, contact, note, is_home, sort_order)
SELECT 'ONE', 'ONE', true, '', '291 서버 활동 동맹', true, 0
WHERE NOT EXISTS (SELECT 1 FROM public.alliances WHERE is_home = true);
