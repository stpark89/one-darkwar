-- guest_answers: 누구나 답변/댓글 작성 가능. 관리자 답변은 is_admin=true 로 구분.
-- 일반 사용자/게스트가 임의로 is_admin=true 를 넣을 수 없도록 INSERT 정책에서 검증.

ALTER TABLE public.guest_answers
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 기존 admin-only INSERT 정책 제거
DROP POLICY IF EXISTS "ga insert admin" ON public.guest_answers;

-- 새 INSERT 정책: is_admin=false 면 누구나 / is_admin=true 면 관리자만
DROP POLICY IF EXISTS "ga insert anyone or admin" ON public.guest_answers;
CREATE POLICY "ga insert anyone or admin" ON public.guest_answers
  FOR INSERT WITH CHECK (
    is_admin = false
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ROLE_ADMIN'
    )
  );
