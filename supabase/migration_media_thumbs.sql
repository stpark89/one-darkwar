-- =============================================
-- 미디어 썸네일 공용 폴더 (media/thumbs/**)
--
-- 배경: 그리드가 원본(1~4MB)을 그대로 받아 대시보드 로딩이 느렸다.
--       업로드 때 만든 썸네일로 바꿨는데, 과거 업로드분은 썸네일이 없어
--       화면이 만났을 때 그 자리에서 만들어 올리게 했다(자가 치유).
--
-- 문제: 원본은 `<userId>/파일` 에 있고 그 폴더는 소유자만 쓸 수 있다.
--       남이 올린 이미지의 썸네일을 만들려다 RLS 에 막혔다
--       (실측: 403 "new row violates row-level security policy").
--
-- 해결: 썸네일만 공용 폴더 `thumbs/` 로 옮기고, 그 폴더에 한해
--       로그인 사용자의 INSERT 를 허용한다. 원본 폴더 권한은 그대로 둔다.
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

-- 로그인 사용자는 thumbs/ 아래에만 새 파일을 만들 수 있다.
-- 덮어쓰기(UPDATE)는 허용하지 않는다 — 치유는 파일이 없을 때만 돈다.
DROP POLICY IF EXISTS "media thumb insert auth" ON storage.objects;
CREATE POLICY "media thumb insert auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'thumbs'
  );

-- 원본을 지울 수 있는 사람은 그 썸네일도 지울 수 있어야 한다.
-- thumbs/<userId>/... 구조라 두 번째 칸이 소유자다.
DROP POLICY IF EXISTS "media thumb delete own" ON storage.objects;
CREATE POLICY "media thumb delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'thumbs'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 읽기는 기존 "media read public" 정책이 이미 버킷 전체를 열어두고 있어
-- 따로 추가하지 않는다.
