import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Send, Loader2, CheckCircle2, XCircle, Clock, Trash2, RotateCcw, Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useTransferStore } from '@/infrastructure/stores/transferStore'
import type { TransferStatus } from '@/domain/entities/Transfer'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { cn } from '@/lib/utils'

const STATUS_META: Record<TransferStatus, { icon: typeof Clock; color: string; bg: string }> = {
  PENDING: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
  APPROVED: { icon: CheckCircle2, color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/15' },
  REJECTED: { icon: XCircle, color: 'text-[var(--color-danger)]', bg: 'bg-[var(--color-danger)]/15' },
}

export const TransferPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, isGuest } = useAuthStore()
  const isAdmin = user?.role === 'ROLE_ADMIN'

  const { apps, loading, submit, loadAll, updateStatus, remove } = useTransferStore()

  const [inGameName, setInGameName] = useState('')
  const [currentServer, setCurrentServer] = useState('')
  const [cp, setCp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [tab, setTab] = useState<TransferStatus>('PENDING')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) loadAll()
  }, [isAdmin, loadAll])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inGameName.trim() || submitting) return
    setSubmitting(true)
    const ok = await submit({ inGameName, currentServer, cp })
    setSubmitting(false)
    if (ok) {
      setSubmitted(true)
      setInGameName('')
      setCurrentServer('')
      setCp('')
      if (isAdmin) loadAll()
    }
  }

  const handleResetForm = () => setSubmitted(false)

  const filtered = apps.filter((a) => a.status === tab)
  const counts = {
    PENDING: apps.filter((a) => a.status === 'PENDING').length,
    APPROVED: apps.filter((a) => a.status === 'APPROVED').length,
    REJECTED: apps.filter((a) => a.status === 'REJECTED').length,
  }

  // 게스트도 관리자도 아닌 일반 회원이 직접 URL로 접근하면 홈으로
  if (!isGuest && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">
          {isAdmin ? t('transfer.admin_title') : t('transfer.title')}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
          {isAdmin ? t('transfer.admin_subtitle') : t('transfer.subtitle')}
        </p>
      </div>

      {/* 신청 폼 또는 완료 카드 — 게스트에게만 노출 */}
      {isGuest && (
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4 sm:p-5 max-w-xl">
        {submitted ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-[var(--color-success)] mx-auto mb-3" />
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-1">{t('transfer.success_title')}</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-5">{t('transfer.success_desc')}</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button variant="outline" size="sm" onClick={handleResetForm}>
                {t('transfer.write_another')}
              </Button>
              <Button size="sm" onClick={() => navigate('/')}>
                <Home className="w-4 h-4" />
                {t('transfer.go_home')}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">{t('transfer.form_title')}</h2>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">{t('transfer.form_hint')}</p>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_name')} *</label>
              <Input
                value={inGameName}
                onChange={(e) => setInGameName(e.target.value)}
                placeholder={t('transfer.field_name_placeholder')}
                required
              />
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_server')}</label>
              <Input
                value={currentServer}
                onChange={(e) => setCurrentServer(e.target.value)}
                placeholder={t('transfer.field_server_placeholder')}
              />
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_cp')}</label>
              <Input
                value={cp}
                onChange={(e) => setCp(e.target.value)}
                placeholder={t('transfer.field_cp_placeholder')}
              />
            </div>

            <Button type="submit" size="full" disabled={!inGameName.trim() || submitting} className="mt-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t('transfer.submit_btn')}
            </Button>
          </form>
        )}
      </div>
      )}

      {/* 관리자 전용: 신청서 목록 */}
      {isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">{t('transfer.admin_list_title')}</h2>
            <button onClick={loadAll} className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              <RotateCcw className="w-3 h-3" /> {t('common.search')}
            </button>
          </div>

          {/* 탭 */}
          <div className="flex gap-1 p-1 bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border-subtle)] w-fit">
            {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setTab(s)}
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5',
                  tab === s
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                )}
              >
                {t(`transfer.tab_${s.toLowerCase()}`)}
                <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', tab === s ? 'bg-white/20' : 'bg-[var(--color-bg-elevated)]')}>
                  {counts[s]}
                </span>
              </button>
            ))}
          </div>

          {/* 목록 */}
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[var(--color-text-muted)]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">{t('transfer.no_data')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((a) => {
                const meta = STATUS_META[a.status]
                const Icon = meta.icon
                return (
                  <div key={a.id} className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate">{a.inGameName}</h3>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                          {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={cn('flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded', meta.bg, meta.color)}>
                        <Icon className="w-3 h-3" />
                        {t(`transfer.status_${a.status.toLowerCase()}`)}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-[var(--color-text-secondary)] mb-3">
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_server')}</span>
                        <span className="text-[var(--color-text-primary)]">{a.currentServer || '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_cp')}</span>
                        <span className="text-[var(--color-text-primary)]">{a.cp || '—'}</span>
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex gap-2 pt-3 border-t border-[var(--color-border-subtle)]">
                      {a.status !== 'APPROVED' && (
                        <button
                          onClick={() => user && updateStatus(a.id, 'APPROVED', user.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" /> {t('transfer.approve_btn')}
                        </button>
                      )}
                      {a.status !== 'REJECTED' && (
                        <button
                          onClick={() => user && updateStatus(a.id, 'REJECTED', user.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold bg-[var(--color-danger)]/15 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/25 transition-colors"
                        >
                          <XCircle className="w-3 h-3" /> {t('transfer.reject_btn')}
                        </button>
                      )}
                      {a.status !== 'PENDING' && (
                        <button
                          onClick={() => user && updateStatus(a.id, 'PENDING', user.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold bg-yellow-400/15 text-yellow-400 hover:bg-yellow-400/25 transition-colors"
                        >
                          <Clock className="w-3 h-3" /> {t('transfer.reopen_btn')}
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteConfirmId(a.id)}
                        className="px-2 py-1.5 rounded text-xs font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)] transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />
              </div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('transfer.delete_title')}</h2>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('transfer.delete_desc')}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="full" onClick={() => setDeleteConfirmId(null)}>{t('common.cancel')}</Button>
              <Button size="full" className="bg-[var(--color-danger)] hover:bg-red-700 text-white"
                onClick={async () => { await remove(deleteConfirmId); setDeleteConfirmId(null) }}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
