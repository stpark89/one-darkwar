-- =============================================
-- 이주 신청서에 신청자가 직접 선택한 티켓 등급 컬럼 추가
-- 등급은 부대 전투력만으로 결정되지 않고 (부대 + 건물 + 연구 + 영웅 합산)
-- 사용자가 본인 등급을 직접 알기 때문에 직접 선택하게 함.
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

ALTER TABLE public.transfer_applications
  ADD COLUMN IF NOT EXISTS tier_id uuid REFERENCES public.transfer_tiers(id) ON DELETE SET NULL;

-- 빠른 필터링용 index
CREATE INDEX IF NOT EXISTS transfer_applications_tier_id_idx
  ON public.transfer_applications(tier_id);
