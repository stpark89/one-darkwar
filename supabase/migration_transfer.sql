-- 이주 신청서 (Transfer Applications)
-- 게스트(미로그인)도 신청 가능, 관리자만 조회/처리 가능

CREATE TABLE IF NOT EXISTS public.transfer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  in_game_name text NOT NULL,
  current_server text NOT NULL DEFAULT '',
  cp text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transfer_applications_status_idx
  ON public.transfer_applications(status, created_at DESC);

ALTER TABLE public.transfer_applications ENABLE ROW LEVEL SECURITY;

-- 누구나(익명 포함) 신청 가능
DROP POLICY IF EXISTS "transfer insert anyone" ON public.transfer_applications;
CREATE POLICY "transfer insert anyone" ON public.transfer_applications
  FOR INSERT
  WITH CHECK (true);

-- 관리자만 조회
DROP POLICY IF EXISTS "transfer select admin" ON public.transfer_applications;
CREATE POLICY "transfer select admin" ON public.transfer_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'ROLE_ADMIN'
    )
  );

-- 관리자만 상태 변경
DROP POLICY IF EXISTS "transfer update admin" ON public.transfer_applications;
CREATE POLICY "transfer update admin" ON public.transfer_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'ROLE_ADMIN'
    )
  );

-- 관리자만 삭제
DROP POLICY IF EXISTS "transfer delete admin" ON public.transfer_applications;
CREATE POLICY "transfer delete admin" ON public.transfer_applications
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'ROLE_ADMIN'
    )
  );
