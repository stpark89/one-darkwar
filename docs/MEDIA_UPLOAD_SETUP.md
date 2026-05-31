# 사진/동영상 업로드 기능 설정 가이드

게시판(게시글/댓글) + 공지사항에 사진/동영상 첨부 가능. 1회 설정.

## 1. Supabase 마이그레이션 실행

Supabase Dashboard → SQL Editor 에서:

```
supabase/migration_media_storage.sql
```

이 마이그레이션이 하는 일:
- `media` Storage 버킷 생성 (public read, 50MB 상한)
- Storage RLS: 로그인 사용자만 업로드, 누구나 읽기, 본인 파일만 삭제
- `posts.media_urls` / `post_comments.media_urls` / `notices.media_urls` text[] 컬럼 추가

## 2. Supabase 요금제 확인

기본 무료 티어는 Storage 1GB 까지. 본격 운영하려면 Pro ($25/월, 100GB) 권장:

Supabase Dashboard → Settings → Billing → Plan

## 3. 동작 확인

배포 후 (1~2분):
1. 게시판 → 새 글 작성 → "사진 / 동영상 첨부" 영역에서 파일 추가
2. 미리보기에 썸네일 표시 → 저장
3. 게시글 펼치면 그리드로 미디어 표시, 클릭하면 라이트박스 풀스크린

공지사항도 동일.

## 운영

### 파일 제한
- 사진: 5MB (초과 시 클라이언트에서 자동 압축, 최대 2400px)
- 동영상: 30MB (압축 없음, 초과 시 거부)
- 첨부 개수: 게시글 5개, 댓글 2개, 공지 5개
- 허용 형식: jpeg/png/gif/webp/heic/heif + mp4/mov/webm/m4v

### 저장 위치
- 버킷: `media` (public)
- 경로: `<user_id>/<timestamp>-<random>.<ext>`
- 사용자별 폴더로 분리 — 누가 올린 파일인지 storage owner 로 추적 가능

### 삭제
- 게시글/댓글/공지에서 미디어 제거 버튼 누르면 Storage 도 함께 정리 시도
- 게시글/공지 자체 삭제는 DB row 만 지움 (Storage 파일은 남음 — orphan 정리는 추후 별도 작업 필요 시)

### 보안
- 누구나 (anon 포함) public URL 로 읽기 가능 — 동맹 내부 공유 목적이라 OK
- 업로드는 로그인 사용자만
- 본인 업로드 파일만 본인이 직접 삭제 가능 (RLS 강제)
- 관리자가 다른 사람 글 삭제 시엔 storage 파일은 남게 됨 (정상 — 추후 cron 으로 청소 가능)

### 트러블슈팅
- **업로드 시 401/403**: 로그인 안 된 상태. SignIn 후 재시도
- **업로드 시 413 (Payload Too Large)**: 파일 50MB 초과 (버킷 file_size_limit). 더 작은 파일로
- **이미지 압축 실패**: HEIC 가 지원 안 되는 경우. 갤러리에서 JPEG 로 변환 후 업로드
- **재생 안 됨**: iOS Safari 에서 일부 코덱 미지원. 표준 mp4(H.264) 권장
