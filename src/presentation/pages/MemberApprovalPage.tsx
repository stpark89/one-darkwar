import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, Check, X, Clock, UserCheck, UserX, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useApprovalStore } from '@/infrastructure/stores/approvalStore'

type Tab = 'pending' | 'rejected'

export const MemberApprovalPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const {
    pendingUsers, loading, loadPending, approveUser, rejectUser,
    rejectedUsers, rejectedLoading, loadRejected, restoreUser, purgeUser,
  } = useApprovalStore()

  const [tab, setTab] = useState<Tab>('pending')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmType, setConfirmType] = useState<'reject' | 'purge' | null>(null)

  useEffect(() => { loadPending() }, [loadPending])
  useEffect(() => { loadRejected() }, [loadRejected])

  if (user?.role !== 'ROLE_ADMIN') return <Navigate to="/members" replace />

  const handleApprove = async (userId: string) => {
    setProcessingId(userId)
    await approveUser(userId)
    setProcessingId(null)
  }

  const handleReject = async (userId: string) => {
    setProcessingId(userId)
    await rejectUser(userId)
    setProcessingId(null)
    setConfirmId(null)
    setConfirmType(null)
  }

  const handleRestore = async (userId: string) => {
    setProcessingId(userId)
    await restoreUser(userId)
    setProcessingId(null)
  }

  const handlePurge = async (userId: string) => {
    setProcessingId(userId)
    await purgeUser(userId)
    setProcessingId(null)
    setConfirmId(null)
    setConfirmType(null)
  }

  const openConfirm = (id: string, type: 'reject' | 'purge') => {
    setConfirmId(id)
    setConfirmType(type)
  }

  const closeConfirm = () => {
    setConfirmId(null)
    setConfirmType(null)
  }

  const confirmTarget =
    confirmType === 'reject'
      ? pendingUsers.find((u) => u.id === confirmId)
      : rejectedUsers.find((u) => u.id === confirmId)

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('nav.join_management')}</h1>
        <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
          {t('approval.page_desc')}
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 bg-[var(--color-bg-elevated)] p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('pending')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'pending'
              ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          {t('approval.tab_pending')}
          {pendingUsers.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[var(--color-brand)] text-white text-[10px] font-bold leading-none">
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('rejected')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'rejected'
              ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <UserX className="w-3.5 h-3.5" />
          {t('approval.tab_rejected')}
          {rejectedUsers.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[var(--color-danger)] text-white text-[10px] font-bold leading-none">
              {rejectedUsers.length}
            </span>
          )}
        </button>
      </div>

      {/* 승인 대기 탭 */}
      {tab === 'pending' && (
        loading ? (
          <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-[var(--color-text-muted)]">
            <UserCheck className="w-10 h-10 opacity-30" />
            <p className="text-sm">{t('approval.no_pending')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]"
              >
                <div className="w-9 h-9 rounded-full bg-[var(--color-brand)]/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-[var(--color-brand)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{u.inGameName}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {new Date(u.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} {t('approval.applied_at')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleApprove(u.id)}
                    disabled={processingId === u.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-success)]/15 text-[var(--color-success)] text-xs font-semibold hover:bg-[var(--color-success)]/25 transition-colors disabled:opacity-50"
                  >
                    {processingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{t('approval.approve')}</span>
                  </button>
                  <button
                    onClick={() => openConfirm(u.id, 'reject')}
                    disabled={processingId === u.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-xs font-semibold hover:bg-[var(--color-danger)]/20 transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t('approval.reject')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 거절된 회원 탭 */}
      {tab === 'rejected' && (
        rejectedLoading ? (
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
                    onClick={() => openConfirm(u.id, 'purge')}
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
        )
      )}

      {/* 확인 모달 (거절 / 완전삭제 공통) */}
      {confirmId && confirmType && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                {confirmType === 'reject' ? <X className="w-5 h-5 text-[var(--color-danger)]" /> : <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                  {confirmType === 'reject' ? t('approval.reject_title') : t('approval.purge_title')}
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{confirmTarget?.inGameName}</p>
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">
              {confirmType === 'reject' ? t('approval.reject_desc') : t('approval.purge_desc')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={closeConfirm}
                className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => confirmType === 'reject' ? handleReject(confirmId) : handlePurge(confirmId)}
                disabled={processingId === confirmId}
                className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-danger)] text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processingId === confirmId
                  ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  : confirmType === 'reject' ? t('approval.reject') : t('approval.purge_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
