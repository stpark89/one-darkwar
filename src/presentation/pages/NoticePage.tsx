import { useEffect, useState } from 'react'
import { Plus, Pin, PinOff, Pencil, Trash2, Loader2, X, ChevronDown, ChevronUp, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNoticeStore } from '@/infrastructure/stores/noticeStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { cn } from '@/lib/utils'

function timeAgo(dateStr: string, t: (k: string, o?: object) => string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return t('notice.just_now')
  if (diff < 3600) return t('notice.minutes_ago', { n: Math.floor(diff / 60) })
  if (diff < 86400) return t('notice.hours_ago', { n: Math.floor(diff / 3600) })
  return t('notice.days_ago', { n: Math.floor(diff / 86400) })
}

export const NoticePage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { notices, loading, loadNotices, addNotice, updateNotice, deleteNotice, togglePin } = useNoticeStore()
  const isAdmin = user?.role === 'ROLE_ADMIN'

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<{ id: string; title: string; content: string } | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => { loadNotices() }, [loadNotices])

  const openAdd = () => {
    setEditTarget(null)
    setFormTitle('')
    setFormContent('')
    setShowModal(true)
  }

  const openEdit = (n: { id: string; title: string; content: string }) => {
    setEditTarget(n)
    setFormTitle(n.title)
    setFormContent(n.content)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditTarget(null)
  }

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim() || !user) return
    setSaving(true)
    if (editTarget) {
      await updateNotice(editTarget.id, formTitle.trim(), formContent.trim())
    } else {
      await addNotice(formTitle.trim(), formContent.trim(), user.id, user.inGameName)
    }
    setSaving(false)
    closeModal()
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await deleteNotice(id)
    setDeletingId(null)
    setDeleteId(null)
  }

  const handleTogglePin = async (id: string) => {
    setTogglingId(id)
    await togglePin(id)
    setTogglingId(null)
  }

  return (
    <div className="p-3 sm:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('notice.title')}</h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
            {t('notice.subtitle', { count: notices.length })}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('notice.add_btn')}</span>
          </Button>
        )}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : notices.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-[var(--color-text-muted)]">
          <Megaphone className="w-10 h-10 opacity-30" />
          <p className="text-sm">{t('notice.no_data')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notices.map((notice) => {
            const isExpanded = expandedId === notice.id
            return (
              <div
                key={notice.id}
                className={cn(
                  'rounded-xl border transition-colors',
                  notice.pinned
                    ? 'border-[var(--color-brand)]/30 bg-[var(--color-brand)]/5'
                    : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]',
                )}
              >
                {/* 카드 헤더 */}
                <button
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : notice.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {notice.pinned && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[var(--color-brand)] bg-[var(--color-brand)]/15 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          <Pin className="w-2.5 h-2.5" /> {t('notice.pinned_badge')}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {notice.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      {notice.authorName} · {timeAgo(notice.createdAt, t)}
                      {notice.updatedAt !== notice.createdAt && (
                        <span className="ml-1 opacity-60">({t('notice.edited')})</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    {isAdmin && (
                      <>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); handleTogglePin(notice.id) }}
                          onKeyDown={(e) => e.key === 'Enter' && handleTogglePin(notice.id)}
                          className={cn(
                            'p-1.5 rounded-lg transition-colors',
                            notice.pinned
                              ? 'text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20'
                              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
                          )}
                          title={notice.pinned ? t('notice.unpin') : t('notice.pin')}
                        >
                          {togglingId === notice.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : notice.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); openEdit(notice) }}
                          onKeyDown={(e) => e.key === 'Enter' && openEdit(notice)}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] transition-colors"
                          title={t('common.edit')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setDeleteId(notice.id) }}
                          onKeyDown={(e) => e.key === 'Enter' && setDeleteId(notice.id)}
                          className="p-1.5 rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      </>
                    )}
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)] ml-1" />
                      : <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] ml-1" />}
                  </div>
                </button>

                {/* 펼쳐진 내용 */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[var(--color-border-subtle)]/60">
                    <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed pt-3">
                      {notice.content}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 작성/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                {editTarget ? t('notice.edit_title') : t('notice.add_title')}
              </h2>
              <button onClick={closeModal} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('notice.title_label')} *</label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t('notice.title_placeholder')}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('notice.content_label')} *</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder={t('notice.content_placeholder')}
                  rows={6}
                  className="w-full text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-brand)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" size="full" onClick={closeModal}>{t('common.cancel')}</Button>
              <Button
                size="full"
                onClick={handleSave}
                disabled={!formTitle.trim() || !formContent.trim() || saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('common.delete')}</h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5 truncate max-w-[200px]">
                  {notices.find((n) => n.id === deleteId)?.title}
                </p>
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('notice.delete_confirm')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deletingId === deleteId}
                className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-danger)] text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingId === deleteId ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
