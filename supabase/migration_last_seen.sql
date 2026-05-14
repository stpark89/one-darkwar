-- profiles 테이블에 last_seen_at 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- RLS: 본인 last_seen_at 업데이트 허용
CREATE POLICY "profiles_update_own_last_seen" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 전체 프로필 조회 허용 (이미 있으면 skip)
-- DO $$ BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_select_all') THEN
--     CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
--   END IF;
-- END $$;
