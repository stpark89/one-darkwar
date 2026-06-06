-- =============================================
-- 291 서버 공용 일정/이벤트 (왕성 공성, 무기고 리셋, 서버 이벤트 등)
--
-- 291 홈에서 다음 일정까지 카운트다운 + 예정 목록 표시.
-- 관리자만 편집, 누구나(게스트 포함) 조회.
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

CREATE TABLE IF NOT EXISTS public.server_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  event_at timestamptz NOT NULL,
  -- 'siege'(왕성 공성) | 'armory'(무기고) | 'event'(서버 이벤트) | 'other'
  category text NOT NULL DEFAULT 'event'
    CHECK (category IN ('siege', 'armory', 'event', 'other')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS server_events_event_at_idx
  ON public.server_events(event_at ASC);

ALTER TABLE public.server_events ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 (게스트 포함)
DROP POLICY IF EXISTS "server_events select all" ON public.server_events;
CREATE POLICY "server_events select all" ON public.server_events
  FOR SELECT USING (true);

-- 관리자만 INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "server_events insert admin" ON public.server_events;
CREATE POLICY "server_events insert admin" ON public.server_events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "server_events update admin" ON public.server_events;
CREATE POLICY "server_events update admin" ON public.server_events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "server_events delete admin" ON public.server_events;
CREATE POLICY "server_events delete admin" ON public.server_events
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ROLE_ADMIN')
  );
