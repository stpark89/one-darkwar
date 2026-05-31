import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { getMediaKind } from '@/lib/uploadMedia'
import { cn } from '@/lib/utils'

interface MediaViewerProps {
  urls: string[]
  className?: string
}

/**
 * 사진/동영상 그리드 + 클릭 시 풀스크린 라이트박스.
 * - 동영상은 인라인 재생도 가능 (controls)
 * - 라이트박스에서 좌/우 키 / 버튼으로 이동, Esc 로 닫기
 */
export const MediaViewer = ({ urls, className }: MediaViewerProps) => {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  useEffect(() => {
    if (lightboxIdx === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null)
      else if (e.key === 'ArrowLeft') setLightboxIdx((i) => (i === null || i === 0 ? i : i - 1))
      else if (e.key === 'ArrowRight') setLightboxIdx((i) => (i === null || i === urls.length - 1 ? i : i + 1))
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [lightboxIdx, urls.length])

  if (urls.length === 0) return null

  return (
    <>
      <div className={cn('grid grid-cols-2 sm:grid-cols-3 gap-2', className)}>
        {urls.map((url, i) => {
          const kind = getMediaKind(url)
          return (
            <div
              key={url}
              className="relative aspect-square rounded-lg overflow-hidden bg-[var(--color-bg-elevated)] cursor-pointer group"
              onClick={() => setLightboxIdx(i)}
            >
              {kind === 'image' ? (
                <img src={url} alt="" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" loading="lazy" />
              ) : kind === 'video' ? (
                <>
                  <video src={url} className="w-full h-full object-cover" preload="metadata" muted />
                  {/* 재생 버튼 오버레이 */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                      <div className="w-0 h-0 border-l-[10px] border-l-white border-y-[6px] border-y-transparent ml-1" />
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* 라이트박스 */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          {/* 닫기 */}
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(null) }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* 이전 */}
          {lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1) }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              aria-label="prev"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* 다음 */}
          {lightboxIdx < urls.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              aria-label="next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* 본문 */}
          <div className="max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const url = urls[lightboxIdx]
              const kind = getMediaKind(url)
              if (kind === 'image') {
                return <img src={url} alt="" className="max-w-[90vw] max-h-[90vh] object-contain" />
              }
              if (kind === 'video') {
                return <video src={url} controls autoPlay className="max-w-[90vw] max-h-[90vh] object-contain" />
              }
              return null
            })()}
          </div>

          {/* 페이지 표시 */}
          {urls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-mono">
              {lightboxIdx + 1} / {urls.length}
            </div>
          )}
        </div>
      )}
    </>
  )
}
