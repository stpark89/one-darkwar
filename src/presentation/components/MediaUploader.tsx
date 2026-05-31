import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X, Film } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { uploadMedia, deleteMediaByUrl, getMediaKind, IMAGE_MAX_BYTES, VIDEO_MAX_BYTES } from '@/lib/uploadMedia'
import { cn } from '@/lib/utils'

interface MediaUploaderProps {
  value: string[]
  onChange: (urls: string[]) => void
  userId: string
  /** 최대 첨부 개수 (기본 5) */
  maxCount?: number
  className?: string
}

/**
 * 사진/동영상 멀티 첨부 업로더.
 * - 파일 선택 → 자동 압축(이미지) → Supabase Storage 업로드 → URL 누적
 * - 미리보기 클릭하면 X 버튼으로 제거 (Storage 도 함께 삭제 시도)
 */
export const MediaUploader = ({ value, onChange, userId, maxCount = 5, className }: MediaUploaderProps) => {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const remaining = Math.max(0, maxCount - value.length)

  const handlePick = () => inputRef.current?.click()

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const incoming = Array.from(files).slice(0, remaining)
    if (incoming.length === 0) {
      toast.error(t('media.max_reached', { n: maxCount }))
      return
    }

    setBusy(true)
    const added: string[] = []
    for (const f of incoming) {
      const kind = getMediaKind(f)
      if (kind === 'unsupported') {
        toast.error(t('media.unsupported_type', { name: f.name }))
        continue
      }
      if (kind === 'video' && f.size > VIDEO_MAX_BYTES) {
        toast.error(t('media.video_too_big', { name: f.name, mb: VIDEO_MAX_BYTES / 1024 / 1024 }))
        continue
      }
      try {
        const url = await uploadMedia(f, userId)
        added.push(url)
      } catch (err) {
        console.error('[MediaUploader] upload failed:', err)
        toast.error(t('media.upload_failed', { name: f.name }))
      }
    }
    if (added.length > 0) onChange([...value, ...added])
    setBusy(false)
    // input 리셋 — 같은 파일 재선택 가능하게
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleRemove = async (url: string) => {
    onChange(value.filter((u) => u !== url))
    // Storage 에서도 정리 (실패해도 UI 에는 영향 없음)
    void deleteMediaByUrl(url)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* 미리보기 그리드 */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.map((url) => {
            const kind = getMediaKind(url)
            return (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-[var(--color-bg-elevated)] group">
                {kind === 'image' ? (
                  <img src={url} alt="" className="w-full h-full object-cover" />
                ) : kind === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center bg-black/40">
                    <Film className="w-6 h-6 text-white/80" />
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleRemove(url)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  aria-label="remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 추가 버튼 */}
      {remaining > 0 && (
        <button
          type="button"
          onClick={handlePick}
          disabled={busy}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:border-[var(--color-brand)]/50 hover:text-[var(--color-text-primary)] transition-colors text-xs sm:text-sm disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          <span>{busy ? t('media.uploading') : t('media.add_btn')}</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {value.length}/{maxCount}
          </span>
        </button>
      )}

      <p className="text-[10px] text-[var(--color-text-muted)] break-keep">
        {t('media.hint', {
          imgMb: IMAGE_MAX_BYTES / 1024 / 1024,
          videoMb: VIDEO_MAX_BYTES / 1024 / 1024,
        })}
      </p>
    </div>
  )
}
