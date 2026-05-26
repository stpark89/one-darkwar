-- =============================================
-- 멤버 삭제 시 연관 데이터 완전 삭제 보장
-- 대상: war_vs_points / war_entries / attendance (이벤트)
-- 처리: ① 기존 고아 데이터 정리  ② ON DELETE CASCADE FK 재설정
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

-- ① 기존 고아 데이터 정리
--    members 테이블에 없는 member_id 를 가진 행을 먼저 삭제
--    (이미 탈퇴/삭제된 멤버의 잔여 데이터 제거)

DELETE FROM public.war_vs_points
  WHERE member_id NOT IN (SELECT id FROM public.members);

DELETE FROM public.war_entries
  WHERE member_id NOT IN (SELECT id FROM public.members);

DELETE FROM public.attendance
  WHERE member_id NOT IN (SELECT id FROM public.members);

-- ② war_vs_points.member_id — ON DELETE CASCADE 재설정

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

-- ③ attendance.member_id — ON DELETE CASCADE 재설정

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.attendance'::regclass
      AND contype = 'f'
      AND conname LIKE '%member_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.attendance DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;
