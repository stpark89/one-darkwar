-- =============================================
-- members ↔ profiles 연결을 인게임명 → profile_id 로 전환
--
-- 배경:
--   두 테이블 사이에 FK 가 없어 인게임명으로만 연결돼 있었다.
--   members.id 는 auth 계정 id 가 아니다(실측: 95건 중 17건만 우연히 일치).
--   이름이 한쪽에서만 바뀌면 연결이 조용히 끊겨서
--   관리자 뱃지가 사라지거나 비밀번호 변경이 "계정 없음" 으로 실패한다.
--
-- 이 마이그레이션 후에는 이름을 몇 번 바꾸든 연결이 유지된다.
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

-- 1) 컬럼 추가 (계정이 없는 멤버도 있으므로 NULL 허용)
--    계정이 삭제되면 멤버 행은 남기고 연결만 끊는다 → ON DELETE SET NULL
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS profile_id uuid
  REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2) 한 계정이 여러 멤버 행에 붙는 것을 방지 (NULL 은 여러 개 허용됨)
CREATE UNIQUE INDEX IF NOT EXISTS members_profile_id_key
  ON public.members (profile_id)
  WHERE profile_id IS NOT NULL;

-- 3) 기존 데이터 backfill — 지금까지 쓰던 이름 매칭 규칙(trim + lower)을 그대로 적용
--    같은 이름의 계정이 2개 이상이면 어느 쪽인지 확정할 수 없으므로 건너뛴다(NULL 유지).
UPDATE public.members m
SET profile_id = p.id
FROM public.profiles p
WHERE m.profile_id IS NULL
  AND lower(btrim(p.in_game_name)) = lower(btrim(m.in_game_name))
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE lower(btrim(p2.in_game_name)) = lower(btrim(m.in_game_name))
      AND p2.id <> p.id
  );

-- 4) 결과 확인용 — 실행 후 이 값들을 확인한다
--    linked  : 계정이 연결된 멤버 수 (예상 62)
--    no_acct : 로그인 계정이 없는 멤버 수 (예상 33)
SELECT
  count(*) FILTER (WHERE profile_id IS NOT NULL) AS linked,
  count(*) FILTER (WHERE profile_id IS NULL)     AS no_acct,
  count(*)                                       AS total
FROM public.members;
