-- 게스트 질문 게시판 (Guest Q&A)
-- 게스트(미로그인) 누구나 질문 작성 가능. 답변은 관리자(ROLE_ADMIN)만.
-- 목록·상세는 모두 공개.

CREATE TABLE IF NOT EXISTS public.guest_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name text NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_questions_created_idx
  ON public.guest_questions(created_at DESC);

CREATE TABLE IF NOT EXISTS public.guest_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.guest_questions(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_answers_question_idx
  ON public.guest_answers(question_id, created_at ASC);

ALTER TABLE public.guest_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_answers ENABLE ROW LEVEL SECURITY;

-- guest_questions: 누구나 INSERT/SELECT, 관리자만 UPDATE/DELETE
DROP POLICY IF EXISTS "gq insert anyone" ON public.guest_questions;
CREATE POLICY "gq insert anyone" ON public.guest_questions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "gq select anyone" ON public.guest_questions;
CREATE POLICY "gq select anyone" ON public.guest_questions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "gq update admin" ON public.guest_questions;
CREATE POLICY "gq update admin" ON public.guest_questions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "gq delete admin" ON public.guest_questions;
CREATE POLICY "gq delete admin" ON public.guest_questions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ROLE_ADMIN')
  );

-- guest_answers: 누구나 SELECT, 관리자만 INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "ga select anyone" ON public.guest_answers;
CREATE POLICY "ga select anyone" ON public.guest_answers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "ga insert admin" ON public.guest_answers;
CREATE POLICY "ga insert admin" ON public.guest_answers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "ga update admin" ON public.guest_answers;
CREATE POLICY "ga update admin" ON public.guest_answers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "ga delete admin" ON public.guest_answers;
CREATE POLICY "ga delete admin" ON public.guest_answers
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ROLE_ADMIN')
  );
