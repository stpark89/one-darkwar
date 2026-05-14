import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, Check, X, Clock, UserCheck } from 'lucide-react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useApprovalStore } from '@/infrastructure/stores/approvalStore'
import { cn } from '@/lib/utils'

export const MemberApprovalPage = () => {
  const { user } = useAuthStore()
  const { pendingUsers, loading, loadPending, approveUser, rejectUser } = useApprovalStore()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null)

  if (user?.role !== 'ROLE_ADMIN') return <Navigate to="/members" replace />

  useEffect(() => { loadPending() }, [loadPending])

  const handleApprove = async (userId: string) => {
    setProcessingId(userId)
    await approveUser(userId)
    setProcessingId(null)
  }

  const handleReject = async (userId: string) => {
    setProcessingId(userId)
    await rejectUser(userId)
    setProcessingId(null)
    setRejectConfirmId(null)
  }

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">회원 승인</h1>
        <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
          가입 신청한 멤버를 승인하거나 거절합니다.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> 불러오는 중...
        </div>
      ) : pendingUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-[var(--color-text-muted)]">
          <UserCheck className="w-10 h-10 opacity-30" />
          <p className="text-sm">승인 대기 중인 회원이 없습니다.</p>
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
                  {new Date(u.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 가입 신청
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleApprove(u.id)}
                  disabled={processingId === u.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-success)]/15 text-[var(--color-success)] text-xs font-semibold hover:bg-[var(--color-success)]/25 transition-colors disabled:opacity-50"
                >
                  {processingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">승인</span>
                </button>
                <button
                  onClick={() => setRejectConfirmId(u.id)}
                  disabled={processingId === u.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-xs font-semibold hover:bg-[var(--color-danger)]/20 transition-colors disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">거절</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 거절 확인 모달 */}
      {rejectConfirmId && (() => {
        const target = pendingUsers.find((u) => u.id === rejectConfirmId)
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                  <X className="w-5 h-5 text-[var(--color-danger)]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text-primary)]">가입 거절</h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{target?.inGameName}</p>
                </div>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-5">
                가입 신청을 거절합니다. 해당 계정은 삭제되며 되돌릴 수 없습니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setRejectConfirmId(null)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => handleReject(rejectConfirmId)}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-danger)] text-white text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  거절
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
