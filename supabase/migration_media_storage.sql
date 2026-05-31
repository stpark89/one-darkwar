-- =============================================
-- 사진/동영상 업로드 기능 (게시판 · 댓글 · 공지)
--
-- 구성:
--  · Supabase Storage 'media' 버킷 (public read)
--  · posts.media_urls / post_comments.media_urls / notices.media_urls 컬럼
--  · Storage RLS: 로그인된 사용자만 업로드, 본인 파일만 삭제
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

-- 1) Storage 버킷 생성 (public read, 50MB 파일 상한)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  52428800, -- 50MB (영상 30MB 여유)
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif',
    'video/mp4','video/quicktime','video/webm','video/x-m4v'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Storage RLS — 로그인 사용자 업로드 / 누구나 읽기 / 본인 파일만 삭제
DROP POLICY IF EXISTS "media upload auth" ON storage.objects;
CREATE POLICY "media upload auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "media read public" ON storage.objects;
CREATE POLICY "media read public" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'media');

DROP POLICY IF EXISTS "media delete own" ON storage.objects;
CREATE POLICY "media delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND owner = auth.uid());

-- 3) 첨부 URL 배열 컬럼 추가
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}';
