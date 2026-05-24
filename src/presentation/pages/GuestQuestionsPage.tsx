import { useEffect, useState } from 'react'
import { Send, Loader2, MessageCircleQuestion, Trash2, Reply, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useGuestQuestionStore } from '@/infrastructure/stores/guestQuestionStore'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { cn } from '@/lib/utils'

export const GuestQuestionsPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ROLE_ADMIN'

  const { questions, loading, loadAll, submit, addAnswer, deleteQuestion, deleteAnswer } = useGuestQuestionStore()

  const [authorName, setAuthorName] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
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

  const handleReply = async (questionId: string) => {
    if (!user) return
    const ok = await addAnswer(questionId, replyContent, user.id, user.inGameName)
    if (ok) {
      setReplyContent('')
      setReplyOpenId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'question') {
      await deleteQuestion(deleteTarget.id)
    } else {
      await deleteAnswer(deleteTarget.id, deleteTarget.questionId)
    }
    setDeleteTarget(null)
  }

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
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="w-4 h-4" /> : <MessageCircleQuestion className="w-4 h-4" />}
          {showForm ? t('common.close') : t('questions.write_btn')}
        </Button>
      </div>

      {/* 작성 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4 sm:p-5 space-y-3 max-w-2xl">
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('questions.field_name')} *</label>
            <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder={t('questions.field_name_placeholder')} required />
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
              rows={4}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-brand)] resize-none"
            />
          </div>
          <Button type="submit" size="full" disabled={!authorName.trim() || !title.trim() || submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {t('questions.submit_btn')}
          </Button>
        </form>
      )}

      {/* 질문 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">{t('questions.no_data')}</div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-[var(--color-text-primary)] mb-1">{q.title}</h3>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {q.authorName} · {new Date(q.createdAt).toLocaleString()}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setDeleteTarget({ type: 'question', id: q.id })}
                    className="p-1.5 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)] transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {q.content && (
                <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap mb-3 leading-relaxed">{q.content}</p>
              )}

              {/* 답변 목록 */}
              {q.answers.length > 0 && (
                <div className="space-y-2 mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
                  {q.answers.map((a) => (
                    <div key={a.id} className="bg-[var(--color-brand)]/8 border-l-2 border-[var(--color-brand)] rounded-r-lg pl-3 pr-2 py-2">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-brand)] font-semibold">
                          <Reply className="w-3 h-3" />
                          {a.authorName} <span className="text-[var(--color-text-muted)] font-normal">· {new Date(a.createdAt).toLocaleString()}</span>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteTarget({ type: 'answer', id: a.id, questionId: q.id })}
                            className="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)] transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">{a.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 관리자: 답변 작성 */}
              {isAdmin && (
                <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
                  {replyOpenId === q.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder={t('questions.reply_placeholder')}
                        rows={3}
                        autoFocus
                        className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-brand)] resize-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setReplyOpenId(null); setReplyContent('') }}
                          className="px-3 py-1.5 rounded text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          onClick={() => handleReply(q.id)}
                          disabled={!replyContent.trim()}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-[var(--color-brand)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                        >
                          <Send className="w-3 h-3" /> {t('questions.reply_submit')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setReplyOpenId(q.id); setReplyContent('') }}
                      className="flex items-center gap-1.5 text-xs text-[var(--color-brand)] hover:underline"
                    >
                      <Reply className="w-3 h-3" /> {t('questions.reply_btn')}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
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
