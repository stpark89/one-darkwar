// 미디어 (사진/동영상) 업로드 헬퍼.
// - 사진: browser-image-compression 으로 자동 압축 (최대 ~5MB)
// - 동영상: 압축 없이 size check 만 (30MB 상한)
// - Supabase Storage 'media' 버킷에 업로드 후 public URL 반환

import imageCompression from 'browser-image-compression'
import { supabase } from '@/lib/supabase'

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024   // 5MB (압축 후 목표)
export const VIDEO_MAX_BYTES = 30 * 1024 * 1024  // 30MB
const STORAGE_BUCKET = 'media'

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
    // 5MB 초과 시 압축. 이미 작아도 한 번 통과시켜 모바일 HEIC 호환성 ↑
    if (file.size > IMAGE_MAX_BYTES || /heic|heif/i.test(file.type)) {
      const compressed = await imageCompression(file, {
        maxSizeMB: IMAGE_MAX_BYTES / 1024 / 1024,
        maxWidthOrHeight: 2400,
        useWebWorker: true,
        fileType: 'image/jpeg',
      })
      toUpload = compressed instanceof File
        ? compressed
        : new File([compressed], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
    }
  } else if (kind === 'video') {
    if (file.size > VIDEO_MAX_BYTES) {
      throw new Error(`동영상은 ${VIDEO_MAX_BYTES / 1024 / 1024}MB 이하만 가능합니다.`)
    }
  }

  const ext = (toUpload.name.split('.').pop() || (kind === 'image' ? 'jpg' : 'mp4')).toLowerCase()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, toUpload, {
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
