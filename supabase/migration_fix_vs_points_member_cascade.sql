-- =============================================
-- war_vs_points.member_id 에 ON DELETE CASCADE 추가
-- 멤버 삭제 시 VS 포인트 데이터도 자동 삭제되도록 보장
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

-- 기존 member_id FK 를 모두 제거 (이름이 환경마다 다를 수 있어 동적 처리)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.war_vs_points'::regclass
      AND contype = 'f'
      AND conname LIKE '%member_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.war_vs_points DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- ON DELETE CASCADE 로 재설정
ALTER TABLE public.war_vs_points
  ADD CONSTRAINT war_vs_points_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;
