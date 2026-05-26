-- =============================================
-- war_vs_points.member_id 에 ON DELETE CASCADE 추가
-- + 기존 고아(orphan) 데이터 정리
-- 멤버 삭제 시 VS 포인트 / 전쟁 참가 데이터도 자동 삭제되도록 보장
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

-- ① 기존 고아 데이터 정리
--    members 테이블에 없는 member_id 를 가진 행을 삭제
--    (이미 탈퇴/삭제된 멤버의 잔여 데이터 제거)

DELETE FROM public.war_vs_points
WHERE member_id NOT IN (SELECT id FROM public.members);

DELETE FROM public.war_entries
WHERE member_id NOT IN (SELECT id FROM public.members);

-- ② war_vs_points.member_id FK: ON DELETE CASCADE 추가
--    (기존 FK 이름이 환경마다 다를 수 있어 동적으로 제거 후 재설정)

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

ALTER TABLE public.war_vs_points
  ADD CONSTRAINT war_vs_points_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;
