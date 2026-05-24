import { useEffect, useState } from 'react'
import { Send, Loader2, MessageCircleQuestion, Trash2, Reply, X, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useGuestQuestionStore } from '@/infrastructure/stores/guestQuestionStore'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { cn } from '@/lib/utils'

const PREVIEW_LIMIT = 80

export const GuestQuestionsPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ROLE_ADMIN'

  const { questions, loading, loadAll, submit, addAnswer, deleteQuestion, deleteAnswer } = useGuestQuestionStore()

  // 작성 모달
  const [showForm, setShowForm] = useState(false)
  const [authorName, setAuthorName] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 상세 모달
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeQuestion = activeId ? questions.find((q) => q.id === activeId) ?? null : null

  // 답변 작성 (상세 모달 안)
  const [replyContent, setReplyContent] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'question'; id: string }
    | { type: 'answer'; id: string; questionId: string }
    | null
  >(null)

  useEffect(() => { loadAll() }, [loadAll])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    const ok = await submit({ authorName, title, content })
    setSubmitting(false)
    if (ok) {
      setAuthorName('')
      setTitle('')
      setContent('')
      setShowForm(false)
    }
  }

  const handleReply = async () => {
    if (!user || !activeQuestion || submittingReply) return
    setSubmittingReply(true)
    const ok = await addAnswer(activeQuestion.id, replyContent, user.id, user.inGameName)
    setSubmittingReply(false)
    if (ok) setReplyContent('')
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'question') {
      await deleteQuestion(deleteTarget.id)
      if (activeId === deleteTarget.id) setActiveId(null)
    } else {
      await deleteAnswer(deleteTarget.id, deleteTarget.questionId)
    }
    setDeleteTarget(null)
  }

  const truncate = (s: string) => (s.length > PREVIEW_LIMIT ? s.slice(0, PREVIEW_LIMIT) + '…' : s)

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <MessageCircleQuestion className="w-5 h-5 text-[var(--color-brand)]" />
            {t('questions.title')}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">{t('questions.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <MessageCircleQuestion className="w-4 h-4" />
          {t('questions.write_btn')}
        </Button>
      </div>

      {/* 질문 카드 목록 (요약만) */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">{t('questions.no_data')}</div>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <button
              key={q.id}
              onClick={() => setActiveId(q.id)}
              className="w-full text-left bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4 hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-bg-elevated)] transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate flex-1">{q.title}</h3>
                {q.answers.length > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)] flex-shrink-0">
                    <MessageSquare className="w-3 h-3" />
                    {q.answers.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] mb-2">
                {q.authorName} · {new Date(q.createdAt).toLocaleString()}
              </p>
              {q.content && (
                <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{truncate(q.content)}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ─── 작성 모달 ─── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)] flex-shrink-0">
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('questions.write_btn')}</h2>
              <button onClick={() => setShowForm(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] -mr-1 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 overflow-y-auto">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('questions.field_name')} *</label>
                <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder={t('questions.field_name_placeholder')} required autoFocus />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('questions.field_title')} *</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('questions.field_title_placeholder')} required />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('questions.field_content')}</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t('questions.field_content_placeholder')}
                  rows={5}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-brand)] resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" size="full" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
                <Button type="submit" size="full" disabled={!authorName.trim() || !title.trim() || submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {t('questions.submit_btn')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 상세 모달 ─── */}
      {activeQuestion && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setActiveId(null)}>
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--color-border-subtle)] flex-shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] break-words">{activeQuestion.title}</h2>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                  {activeQuestion.authorName} · {new Date(activeQuestion.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 -mt-1 -mr-1">
                {isAdmin && (
                  <button
                    onClick={() => setDeleteTarget({ type: 'question', id: activeQuestion.id })}
                    className="p-1.5 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setActiveId(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1.5">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {activeQuestion.content && (
                <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap break-words leading-relaxed">{activeQuestion.content}</p>
              )}

              {/* 답변 목록 */}
              {activeQuestion.answers.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-[var(--color-border-subtle)]">
                  <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                    {activeQuestion.answers.length} {t('board.comment_count', { n: activeQuestion.answers.length }).replace(/^\d+\s*/, '')}
                  </p>
                  {activeQuestion.answers.map((a) => (
                    <div key={a.id} className="bg-[var(--color-brand)]/8 border-l-2 border-[var(--color-brand)] rounded-r-lg pl-3 pr-2 py-2">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-brand)] font-semibold">
                          <Reply className="w-3 h-3" />
                          {a.authorName} <span className="text-[var(--color-text-muted)] font-normal">· {new Date(a.createdAt).toLocaleString()}</span>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteTarget({ type: 'answer', id: a.id, questionId: activeQuestion.id })}
                            className="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)] transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap break-words leading-relaxed">{a.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 관리자 답변 작성 */}
            {isAdmin && (
              <div className="px-5 py-3 border-t border-[var(--color-border-subtle)] flex-shrink-0 space-y-2">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={t('questions.reply_placeholder')}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-brand)] resize-none"
                />
                <button
                  onClick={handleReply}
                  disabled={!replyContent.trim() || submittingReply}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--color-brand)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {submittingReply ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  {t('questions.reply_submit')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />
              </div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                {deleteTarget.type === 'question' ? t('questions.delete_q_title') : t('questions.delete_a_title')}
              </h2>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('questions.delete_desc')}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="full" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
              <Button size="full" className={cn('bg-[var(--color-danger)] hover:bg-red-700 text-white')} onClick={confirmDelete}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
