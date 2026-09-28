// 미디어 (사진/동영상) 업로드 헬퍼.
// - 사진: 항상 압축(장변 1920 · ~1MB). 표시용 축소는 Storage image transform 이 한다
// - 동영상: 압축 없이 size check 만 (30MB 상한)
// - Supabase Storage 'media' 버킷에 업로드 후 public URL 반환

import imageCompression from 'browser-image-compression'
import { supabase } from '@/lib/supabase'

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024   // 5MB — 입력 허용 상한
export const VIDEO_MAX_BYTES = 30 * 1024 * 1024  // 30MB
const STORAGE_BUCKET = 'media'

// 압축 목표. 예전엔 5MB 를 넘을 때만 압축했는데, 게임 스크린샷은 대개 1~4MB 라
// 사실상 아무것도 압축되지 않고 원본이 그대로 올라갔다 — 업로드가 느린 주된 이유였다.
const IMAGE_TARGET_MB = 1
const IMAGE_MAX_DIMENSION = 1920
// 이보다 작은 이미지는 재인코딩해봐야 득이 없다
const COMPRESS_SKIP_BYTES = 300 * 1024

// 표시용 축소는 Supabase Storage image transform 에 맡긴다(Pro 플랜).
// object 경로를 render 경로로 바꾸면 서버가 리사이즈해서 준다 — 이미 올라가 있는
// 이미지에도 그대로 적용되고, 업로드도 권한도 필요 없다.
//
// ⚠️ 직접 썸네일을 만들어 올리는 방식(무료 플랜 호환)을 먼저 시도했다가 되돌렸다.
// 실측: 로그인 상태에서는 생성되지만 게스트에서는 403 이다 — 썸네일 업로드는
// authenticated 전용인데 게스트 모드는 localStorage 플래그일 뿐 Supabase 세션이
// 없어 anon 으로 나간다. 게스트도 보는 화면이라 그 방식으로는 영영 안 채워지고
// 403 요청만 쌓인다. transform 은 업로드도 권한도 없어 이 문제가 성립하지 않는다.
const OBJECT_PATH = '/storage/v1/object/public/'
const RENDER_PATH = '/storage/v1/render/image/public/'

/**
 * 표시용 축소 URL. 96~200px 칸에 원본(1~4MB)을 넣으면 한 화면이 수십 MB 가 된다.
 * 이미지가 아니거나 변환 대상이 아니면 원본 URL 을 그대로 돌려준다.
 *
 * @param width 요청할 가로 픽셀. 레티나를 감안해 표시 크기의 2배쯤 준다.
 */
export function displayUrl(url: string, width: number, quality = 70): string {
  if (getMediaKind(url) !== 'image') return url
  if (!url.includes(OBJECT_PATH)) return url
  return `${url.replace(OBJECT_PATH, RENDER_PATH)}?width=${width}&quality=${quality}`
}

export type MediaKind = 'image' | 'video' | 'unsupported'

export function getMediaKind(file: File | string): MediaKind {
  const t = typeof file === 'string' ? file : file.type
  // 문자열(URL) 일 땐 확장자로 추정
  if (typeof file === 'string') {
    const ext = file.split('.').pop()?.toLowerCase() ?? ''
    if (['jpg','jpeg','png','gif','webp','heic','heif'].includes(ext)) return 'image'
    if (['mp4','mov','webm','m4v'].includes(ext)) return 'video'
    return 'unsupported'
  }
  if (t.startsWith('image/')) return 'image'
  if (t.startsWith('video/')) return 'video'
  return 'unsupported'
}

/** 이미지를 목표 용량·장변으로 줄여 jpeg File 로 돌려준다. */
async function compressTo(file: File, maxSizeMB: number, maxWidthOrHeight: number): Promise<File> {
  const out = await imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: 'image/jpeg',
  })
  return out instanceof File
    ? out
    : new File([out], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
}

/**
 * 파일을 압축(이미지일 때) + Supabase Storage 업로드 → public URL 반환.
 * 실패 시 throw.
 */
export async function uploadMedia(file: File, userId: string): Promise<string> {
  const kind = getMediaKind(file)
  if (kind === 'unsupported') {
    throw new Error('지원하지 않는 형식입니다.')
  }

  let toUpload: File = file

  if (kind === 'image') {
    // 아주 작은 파일이 아니면 항상 압축한다. HEIC 는 크기와 무관하게 통과시켜
    // jpeg 로 바꿔야 모바일 외 브라우저에서 보인다.
    if (file.size > COMPRESS_SKIP_BYTES || /heic|heif/i.test(file.type)) {
      toUpload = await compressTo(file, IMAGE_TARGET_MB, IMAGE_MAX_DIMENSION)
    }
  } else if (kind === 'video') {
    if (file.size > VIDEO_MAX_BYTES) {
      throw new Error(`동영상은 ${VIDEO_MAX_BYTES / 1024 / 1024}MB 이하만 가능합니다.`)
    }
  }

  const ext = (toUpload.name.split('.').pop() || (kind === 'image' ? 'jpg' : 'mp4')).toLowerCase()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, toUpload, {
    // ⚠️ 1년(31536000)으로 늘렸더니 Storage 가 업로드를 400 으로 거부했다(실측).
    // 검증된 값은 3600 이다 — 늘리려면 실제 업로드로 확인하고 늘려라.
    cacheControl: '3600',
    upsert: false,
    contentType: toUpload.type || undefined,
  })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * 여러 파일 업로드 — 일부 실패해도 나머지 진행. 성공 URL 만 반환.
 */
export async function uploadMediaBatch(files: File[], userId: string): Promise<string[]> {
  const results = await Promise.allSettled(files.map((f) => uploadMedia(f, userId)))
  const urls: string[] = []
  results.forEach((r) => {
    if (r.status === 'fulfilled') urls.push(r.value)
    else console.error('[uploadMedia] failed:', r.reason)
  })
  return urls
}

/**
 * Public URL 에서 storage path 를 추출해 삭제. 실패 시 false.
 * URL 형식: https://<project>.supabase.co/storage/v1/object/public/media/<path>
 */
export async function deleteMediaByUrl(url: string): Promise<boolean> {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return false
  const path = url.slice(idx + marker.length)
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path])
  if (error) {
    console.error('[deleteMediaByUrl] failed:', error)
    return false
  }
  return true
}
