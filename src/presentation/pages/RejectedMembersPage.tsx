import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, Trash2, UserX, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useApprovalStore } from '@/infrastructure/stores/approvalStore'

export const RejectedMembersPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { rejectedUsers, rejectedLoading, loadRejected, restoreUser, purgeUser } = useApprovalStore()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [purgeConfirmId, setPurgeConfirmId] = useState<string | null>(null)

  useEffect(() => { loadRejected() }, [loadRejected])

  if (user?.role !== 'ROLE_ADMIN') return <Navigate to="/members" replace />

  const handleRestore = async (userId: string) => {
    setProcessingId(userId)
    await restoreUser(userId)
    setProcessingId(null)
  }

  const handlePurge = async (userId: string) => {
    setProcessingId(userId)
    await purgeUser(userId)
    setProcessingId(null)
    setPurgeConfirmId(null)
  }

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('nav.rejected_members')}</h1>
        <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
          {t('approval.rejected_desc')}
        </p>
      </div>

      {rejectedLoading ? (
        <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : rejectedUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-[var(--color-text-muted)]">
          <UserX className="w-10 h-10 opacity-30" />
          <p className="text-sm">{t('approval.no_rejected')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rejectedUsers.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]"
            >
              <div className="w-9 h-9 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center flex-shrink-0">
                <UserX className="w-4 h-4 text-[var(--color-danger)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{u.inGameName}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {new Date(u.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} {t('approval.applied_at')}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleRestore(u.id)}
                  disabled={processingId === u.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-success)]/15 text-[var(--color-success)] text-xs font-semibold hover:bg-[var(--color-success)]/25 transition-colors disabled:opacity-50"
                >
                  {processingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{t('approval.restore')}</span>
                </button>
                <button
                  onClick={() => setPurgeConfirmId(u.id)}
                  disabled={processingId === u.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-xs font-semibold hover:bg-[var(--color-danger)]/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('approval.purge')}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 완전 삭제 확인 모달 */}
      {purgeConfirmId && (() => {
        const target = rejectedUsers.find((u) => u.id === purgeConfirmId)
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('approval.purge_title')}</h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{target?.inGameName}</p>
                </div>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-5">
                {t('approval.purge_desc')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPurgeConfirmId(null)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => handlePurge(purgeConfirmId)}
                  disabled={processingId === purgeConfirmId}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-danger)] text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {processingId === purgeConfirmId ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('approval.purge_confirm')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
