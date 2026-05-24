-- VS POINT 의 회차를 BLACK GOLD 의 회차(war_rounds)와 분리.
-- BG 는 격주, VS 는 매주처럼 주기가 달라 같은 테이블을 공유하면 안 됨.
-- 본 마이그레이션은 옵션 A(양쪽 다 보존)에 해당:
--   기존 war_rounds 의 모든 행을 vs_rounds 로 동일 id 로 복사하여,
--   이미 입력된 war_vs_points 데이터(round_id 참조)가 그대로 보존되도록 함.

-- 1) vs_rounds 테이블 신설 (war_rounds 와 동일 스키마)
CREATE TABLE IF NOT EXISTS public.vs_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  round_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vs_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public access" ON public.vs_rounds;
CREATE POLICY "public access" ON public.vs_rounds
  FOR ALL USING (true) WITH CHECK (true);

-- 2) 기존 war_rounds 행을 vs_rounds 로 동일 id 복사
--    같은 id 로 복사하므로 기존 war_vs_points.round_id 값이
--    그대로 vs_rounds.id 를 가리키게 됨 → 데이터 손실 없음
INSERT INTO public.vs_rounds (id, season_id, sort_order, round_date, created_at)
SELECT id, season_id, sort_order, round_date, created_at
FROM public.war_rounds
ON CONFLICT (id) DO NOTHING;

-- 3) war_vs_points 의 round_id FK 를 war_rounds → vs_rounds 로 교체
--    FK 이름이 환경마다 다를 수 있어 동적으로 모든 round_id 관련 FK 를 떼고 새로 건다
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.war_vs_points'::regclass
      AND contype = 'f'
      AND conname LIKE '%round_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.war_vs_points DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.war_vs_points
  ADD CONSTRAINT war_vs_points_round_id_fkey
  FOREIGN KEY (round_id) REFERENCES public.vs_rounds(id) ON DELETE CASCADE;

-- 이제 BG 의 war_rounds 와 VS 의 vs_rounds 는 완전히 독립.
-- BG 페이지에서 회차 삭제 → war_rounds 행 + war_entries 만 삭제 (VS 영향 없음).
-- VS 페이지에서 회차 삭제 → vs_rounds 행 + war_vs_points 만 삭제 (BG 영향 없음).
