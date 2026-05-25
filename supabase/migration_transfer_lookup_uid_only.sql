-- =============================================
-- 이주 신청 조회 RPC: UID 만으로 조회되게 완화
--
-- 이전엔 인게임명 + UID 둘 다 정확히 매칭돼야 했음. 사용자가 이름을
-- 잘못 입력하면 조회 안 되는 불편이 있어, UID 만으로 조회 가능하게 변경.
-- p_name 인자는 그대로 두되 무시 (하위 호환).
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

CREATE OR REPLACE FUNCTION public.get_my_transfer(p_name text, p_uid text)
RETURNS SETOF public.transfer_applications
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- UID 매칭만으로 조회. p_uid 비어있으면 결과 없음 (보안: 빈 인자로 전체 노출 금지)
  -- p_name 은 무시 — 시그니처 호환성 유지를 위해 인자 그대로 둠
  SELECT *
  FROM public.transfer_applications
  WHERE TRIM(uid) = TRIM(p_uid)
    AND TRIM(p_uid) <> ''
  ORDER BY created_at DESC;
$$;

-- 권한은 그대로 유지 (이전 마이그레이션에서 부여됨)
