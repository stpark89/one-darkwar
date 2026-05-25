-- =============================================
-- 이주 신청 상태 조회 기능
-- 신청자(게스트)가 인게임명 + UID 로 본인 신청 상태를 조회할 수 있게 함
-- + 관리자가 승인/거절 시 신청자에게 보여줄 메시지를 남길 수 있게 함
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

-- 1) 관리자 메시지 컬럼 추가
ALTER TABLE public.transfer_applications
  ADD COLUMN IF NOT EXISTS admin_message text NOT NULL DEFAULT '';

-- 2) 인게임명 + UID 로 본인 신청을 조회하는 RPC 함수
--    SECURITY DEFINER 로 RLS 우회하되, name + uid 둘 다 매칭 필수.
--    uid 가 빈 문자열이면 매칭 불가 (보안: 이름만으로 남의 신청 못 봄)
CREATE OR REPLACE FUNCTION public.get_my_transfer(p_name text, p_uid text)
RETURNS SETOF public.transfer_applications
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.transfer_applications
  WHERE TRIM(LOWER(in_game_name)) = TRIM(LOWER(p_name))
    AND TRIM(uid) = TRIM(p_uid)
    AND TRIM(p_uid) <> ''  -- UID 비어있으면 결과 없음
  ORDER BY created_at DESC;
$$;

-- 익명 사용자(anon)도 호출 가능하도록 권한 부여
GRANT EXECUTE ON FUNCTION public.get_my_transfer(text, text) TO anon, authenticated;
