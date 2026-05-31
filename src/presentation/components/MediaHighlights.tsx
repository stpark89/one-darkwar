import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronLeft, ChevronRight, MessageSquare, Megaphone, Image as ImageIcon, ChevronRight as ChevronRightSmall } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getMediaKind } from '@/lib/uploadMedia'
import { cn } from '@/lib/utils'

export interface MediaItem {
  url: string
  sourceType: 'post' | 'notice'
  sourceId: string
  sourceTitle: string
  authorName: string
  createdAt: string
}

interface Props {
  items: MediaItem[]
  /** 표시 한도 (기본 12) */
  maxItems?: number
  className?: string
}

/**
 * 홈 화면용 가로 스크롤 미디어 하이라이트.
 * - posts + notices 의 첫 미디어 모아서 최근순 노출
 * - 클릭 → 라이트박스 (이미지/영상 풀스크린 + 메타 + 게시글 이동 버튼)
 */
export const MediaHighlights = ({ items, maxItems = 12, className }: Props) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  const list = items.slice(0, maxItems)

  useEffect(() => {
    if (lightboxIdx === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null)
      else if (e.key === 'ArrowLeft') setLightboxIdx((i) => (i === null || i === 0 ? i : i - 1))
      else if (e.key === 'ArrowRight') setLightboxIdx((i) => (i === null || i === list.length - 1 ? i : i + 1))
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [lightboxIdx, list.length])

  if (list.length === 0) return null

  const current = lightboxIdx !== null ? list[lightboxIdx] : null

  const handleGotoSource = () => {
    if (!current) return
    setLightboxIdx(null)
    // 임시 — 해당 페이지로 이동. 추후 #anchor 로 스크롤 처리 가능
    if (current.sourceType === 'post') navigate('/board')
    else navigate('/notices')
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-[var(--color-brand)]" />
          {t('home.media_highlights_title')}
        </h2>
        <button
          onClick={() => navigate('/board')}
          className="text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-0.5 transition-colors"
        >
          {t('home.media_highlights_more')}
          <ChevronRightSmall className="w-3 h-3" />
        </button>
      </div>

      {/* 가로 스크롤 */}
      <div className="-mx-3 sm:-mx-6 px-3 sm:px-6 overflow-x-auto">
        <div className="flex gap-2 pb-1" style={{ minWidth: 'min-content' }}>
          {list.map((item, i) => {
            const kind = getMediaKind(item.url)
            return (
              <button
                key={`${item.sourceId}-${i}`}
                onClick={() => setLightboxIdx(i)}
                className="flex-shrink-0 relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden bg-[var(--color-bg-elevated)] group hover:ring-2 hover:ring-[var(--color-brand)]/50 transition-all"
                title={item.sourceTitle}
              >
                {kind === 'image' ? (
                  <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : kind === 'video' ? (
                  <>
                    <video src={item.url} className="w-full h-full object-cover" preload="metadata" muted />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                        <div className="w-0 h-0 border-l-[7px] border-l-white border-y-[5px] border-y-transparent ml-0.5" />
                      </div>
                    </div>
                  </>
                ) : null}
                {/* 출처 배지 */}
                <span className={cn(
                  'absolute top-1 left-1 flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold text-white',
                  item.sourceType === 'notice' ? 'bg-[var(--color-brand)]/80' : 'bg-black/60',
                )}>
                  {item.sourceType === 'notice'
                    ? <Megaphone className="w-2.5 h-2.5" />
                    : <MessageSquare className="w-2.5 h-2.5" />}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 라이트박스 */}
      {current && lightboxIdx !== null && (
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
          {lightboxIdx < list.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              aria-label="next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* 본문 + 메타 */}
          <div
            className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const kind = getMediaKind(current.url)
              if (kind === 'image') {
                return <img src={current.url} alt="" className="max-w-[90vw] max-h-[70vh] object-contain rounded" />
              }
              if (kind === 'video') {
                return <video src={current.url} controls autoPlay className="max-w-[90vw] max-h-[70vh] object-contain rounded" />
              }
              return null
            })()}

            {/* 메타 + 이동 버튼 */}
            <div className="w-full max-w-md px-4 py-3 rounded-lg bg-black/60 text-white space-y-2 break-keep">
              <div className="flex items-center gap-1.5 text-[11px] text-white/70">
                {current.sourceType === 'notice'
                  ? <><Megaphone className="w-3 h-3" /> {t('notice.title')}</>
                  : <><MessageSquare className="w-3 h-3" /> {t('board.title')}</>}
                <span className="mx-1">·</span>
                <span>{current.authorName}</span>
              </div>
              <p className="text-sm font-semibold truncate">{current.sourceTitle}</p>
              <button
                onClick={handleGotoSource}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-brand)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {t('home.media_goto_source')}
                <ChevronRightSmall className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 페이지 표시 */}
          {list.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-mono">
              {lightboxIdx + 1} / {list.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
