-- =============================================
-- 티켓 등급 정리: 예전 등급 삭제 + 새 4개만 유지
--
-- ※ 중요: 이주 등급은 (건물 + 과학기술 + 영웅 + 개조차) 전투력 합산값이라
--   신청서의 cp(부대 전투력)로는 계산할 수 없다. 따라서 등급은 신청자가
--   직접 선택한 값(tier_id)만 사용하며, CP 로 자동 배정하지 않는다.
--   → 예전의 'CP 기준 재배정'은 사용하지 않는다.
--
-- 옛 등급을 삭제하면 그 등급을 가리키던 신청서의 tier_id 는:
--   · (옵션 A·권장) 같은 '색상'의 새 등급으로 이전 → 사용자가 고른 색상 보존
--   · (옵션 B) 그냥 삭제 → FK ON DELETE SET NULL 로 NULL(미지정),
--             이후 신청자/관리자가 다시 선택
--
-- Supabase Dashboard → SQL Editor 에서 실행 (1 → 2 → 3 → 4 순서)
-- =============================================


-- ┌─ 1) 확인 — 현재 등급 목록 (색상 포함) ─────────────────────────────┐
SELECT id, name, color, min_cp, max_cp, sort_order, created_at
FROM public.transfer_tiers
ORDER BY created_at;


-- ┌─ 2) (옵션 A·권장) 색상 보존 이전 ──────────────────────────────────┐
-- 삭제될 옛 등급을 가리키는 신청서를, 같은 색상의 '남길 새 등급'으로 옮긴다.
-- (옵션 B 를 원하면 이 블록을 건너뛰고 바로 3) 실행 → tier_id 가 NULL 이 됨)
WITH keep AS (
  SELECT DISTINCT ON (name) id, color
  FROM public.transfer_tiers
  WHERE name IN ('Elite', 'Advanced', 'Medium', 'Regular')
  ORDER BY name, created_at DESC
)
UPDATE public.transfer_applications ta
SET tier_id = (SELECT k.id FROM keep k WHERE k.color = old.color LIMIT 1)
FROM public.transfer_tiers old
WHERE ta.tier_id = old.id
  AND old.id NOT IN (SELECT id FROM keep)
  AND EXISTS (SELECT 1 FROM keep k WHERE k.color = old.color);


-- ┌─ 3) 삭제 — 새 4개(이름 기준 최신)만 남기고 전부 삭제 ──────────────┐
-- ※ 위 1) 결과에서 남길 4개 이름이 아래와 다르면 이름을 맞춰 수정할 것.
DELETE FROM public.transfer_tiers
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM public.transfer_tiers
  WHERE name IN ('Elite', 'Advanced', 'Medium', 'Regular')
  ORDER BY name, created_at DESC
);


-- ┌─ 4) 결과 확인 — 등급별 신청 인원 ─────────────────────────────────┐
SELECT tt.name, tt.color, count(ta.id) AS apps
FROM public.transfer_tiers tt
LEFT JOIN public.transfer_applications ta ON ta.tier_id = tt.id
GROUP BY tt.name, tt.color, tt.sort_order
ORDER BY tt.sort_order;

-- 참고: 등급 미지정(tier_id IS NULL) 신청자 수
-- SELECT count(*) FROM public.transfer_applications WHERE tier_id IS NULL;
