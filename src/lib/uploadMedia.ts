// 미디어 (사진/동영상) 업로드 헬퍼.
// - 사진: 항상 압축(장변 1920 · ~1MB) + 그리드용 썸네일(장변 480)을 함께 올린다
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

// 그리드 썸네일. 96~200px 칸에 원본(1~4MB)을 넣으면 한 화면이 수십 MB 가 된다.
// Storage image transform 은 유료 플랜 전용이라 쓰지 않는다 — 업로드 때 직접 만든다.
export const THUMB_TARGET_MB = 0.06
export const THUMB_MAX_DIMENSION = 480
export const THUMB_SUFFIX = '.thumb.jpg'
// 썸네일은 업로더 폴더가 아니라 공용 폴더에 둔다.
// 원본은 `<userId>/파일` 에 있고 그 폴더는 소유자만 쓸 수 있어서, 남이 올린
// 이미지의 썸네일을 만들려다 RLS 에 막혔다(실측: 403 "new row violates RLS").
export const THUMB_PREFIX = 'thumbs/'

/** 원본 storage path → 썸네일 storage path */
function toThumbPath(path: string): string {
  return THUMB_PREFIX + path.replace(/\.[^./?]+$/, THUMB_SUFFIX)
}

/**
 * 원본 public URL 에서 썸네일 URL 을 유도한다. 저장 구조(문자열 URL 배열)를
 * 바꾸지 않으려고 경로 규칙으로만 잇는다 — 썸네일이 아직 없는 과거 업로드분은
 * 404 가 나므로 표시 쪽에서 onError 로 원본에 폴백한다.
 */
export function thumbUrl(url: string): string {
  if (getMediaKind(url) !== 'image') return url
  if (url.includes(`/${STORAGE_BUCKET}/${THUMB_PREFIX}`)) return url
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return url
  const head = url.slice(0, idx + marker.length)
  return head + toThumbPath(url.slice(idx + marker.length))
}

/** 원본 public URL 에 대응하는 썸네일을 만들어 공용 폴더에 올린다. */
export async function uploadThumbFor(url: string, source: File | Blob): Promise<boolean> {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return false
  const path = toThumbPath(url.slice(idx + marker.length))
  try {
    const asFile =
      source instanceof File ? source : new File([source], 'src.jpg', { type: source.type || 'image/jpeg' })
    const thumb = await compressTo(asFile, THUMB_TARGET_MB, THUMB_MAX_DIMENSION)
    // upsert 는 쓰지 않는다 — storage RLS 에 UPDATE 정책이 없어 덮어쓰기가 막힌다.
    // 이미 있으면 만들 이유도 없다(치유는 404 일 때만 돈다).
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, thumb, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/jpeg',
    })
    if (error) throw error
    return true
  } catch (err) {
    console.warn('[uploadThumbFor] failed:', url, err)
    return false
  }
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

// 자가 치유 중복 방지 — 같은 URL 을 여러 칸이 동시에 만나도 한 번만 만든다
const healing = new Set<string>()

/**
 * 썸네일이 없는 과거 업로드분을 발견했을 때 그 자리에서 만들어 올린다.
 * 화면이 한 번 훑고 나면 채워지므로 관리자가 따로 백필을 돌릴 필요가 없다.
 * 권한이 없거나(게스트) 실패하면 조용히 넘어간다 — 표시는 원본 폴백으로 이미 된다.
 */
export function healThumb(url: string): void {
  if (getMediaKind(url) !== 'image' || healing.has(url)) return
  healing.add(url)
  void (async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) return
      await uploadThumbFor(url, await res.blob())
    } catch (err) {
      console.warn('[healThumb] skipped:', url, err)
    }
  })()
}

/**
 * 파일을 압축(이미지일 때) + Supabase Storage 업로드 → public URL 반환.
 * 이미지는 그리드용 썸네일도 함께 올린다(실패해도 원본 업로드는 살린다).
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

  // 썸네일은 부가물이다 — 실패해도 원본 업로드를 되돌리지 않는다(표시 쪽에서 원본 폴백)
  if (kind === 'image') await uploadThumbFor(data.publicUrl, toUpload)

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
  // 썸네일도 같이 지운다 — 없으면 remove 가 조용히 넘어간다
  const paths = [path]
  if (getMediaKind(url) === 'image') paths.push(toThumbPath(path))
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths)
  if (error) {
    console.error('[deleteMediaByUrl] failed:', error)
    return false
  }
  return true
}
