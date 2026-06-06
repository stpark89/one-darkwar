import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle, Clock, Trash2, RotateCcw, Layers, Pencil, Plus, Save, X, Search, Bell, BellOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useTransferStore } from '@/infrastructure/stores/transferStore'
import { useTransferTierStore, findTierForCp } from '@/infrastructure/stores/transferTierStore'
import type { TransferStatus } from '@/domain/entities/Transfer'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { TransferSubmitForm } from '@/presentation/components/TransferSubmitForm'
import { parseCp, formatCp } from '@/lib/cp'
import { isPushSupported, isCurrentlySubscribed, subscribeToPush, unsubscribeFromPush } from '@/lib/push'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface TierDraftForm {
  id?: string
  name: string
  minCpStr: string
  maxCpStr: string
  capacityStr: string
  sortOrderStr: string
  seasonName: string
}

const EMPTY_TIER_DRAFT: TierDraftForm = { name: '', minCpStr: '', maxCpStr: '', capacityStr: '0', sortOrderStr: '0', seasonName: '' }

// 게임 룰상 티켓 등급 최대치 (주황·보라·파랑·회색)
const MAX_TIERS = 4

// "3.54G" → 3540, "" → null
const parseTierInput = (s: string): number | null => {
  const t = s.trim().toUpperCase()
  if (!t) return null
  const num = parseFloat(t.replace(/[^0-9.]/g, ''))
  if (isNaN(num)) return null
  if (t.includes('G') || t.includes('B')) return Math.round(num * 1000)
  return Math.round(num)
}

const formatTierRange = (minCp: number, maxCp: number | null) => {
  const min = minCp > 0 ? formatCp(minCp) : '0'
  const max = maxCp != null ? formatCp(maxCp) : '∞'
  return `${min} ~ ${max}`
}

const STATUS_META: Record<TransferStatus, { icon: typeof Clock; color: string; bg: string }> = {
  PENDING: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
  APPROVED: { icon: CheckCircle2, color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/15' },
  REJECTED: { icon: XCircle, color: 'text-[var(--color-danger)]', bg: 'bg-[var(--color-danger)]/15' },
}

// 국가 옵션 — 저장은 코드값(KR/VN/TW/CN/JP/EN/OTHER), 표시는 t()로 다국어 라벨
const COUNTRY_OPTIONS = ['KR', 'VN', 'TW', 'CN', 'JP', 'EN', 'OTHER'] as const
const COUNTRY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', VN: '🇻🇳', TW: '🇹🇼', CN: '🇨🇳', JP: '🇯🇵', EN: '🇺🇸', OTHER: '🌐',
}

export const TransferPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, isGuest } = useAuthStore()
  const isAdmin = user?.role === 'ROLE_ADMIN'

  const { apps, loading, loadAll, updateStatus, updateAdminMessage, updateTier, remove } = useTransferStore()
  const { tiers, loadAll: loadTiers, upsert: upsertTier, remove: removeTier } = useTransferTierStore()

  // 게스트 신청 폼은 <TransferSubmitForm /> 에서 자체 state 관리 (분리됨)
  const [tab, setTab] = useState<TransferStatus>('PENDING')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // 검색·필터 (관리자만 사용)
  const [searchQuery, setSearchQuery] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all') // 'all' | tier.id | 'unmatched'
  const [allianceFilter, setAllianceFilter] = useState<'all' | 'ONE' | 'NXO' | 'NH_D' | 'OTHER'>('all')

  // 관리자: 신청서 카드에서 등급 변경 드롭다운 열림 상태
  const [adminTierEditId, setAdminTierEditId] = useState<string | null>(null)

  // 관리자: 신청서별 admin_message 입력 드래프트 (저장 전 로컬값)
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({})
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null)

  // 관리자: 푸시 알림 구독 상태
  const [pushSubscribed, setPushSubscribed] = useState<boolean>(false)
  const [pushBusy, setPushBusy] = useState<boolean>(false)
  const pushSupported = isPushSupported()

  useEffect(() => {
    if (!isAdmin || !pushSupported) return
    isCurrentlySubscribed().then(setPushSubscribed).catch(() => setPushSubscribed(false))
  }, [isAdmin, pushSupported])

  const handleTogglePush = async () => {
    if (!user || pushBusy) return
    setPushBusy(true)
    try {
      if (pushSubscribed) {
        await unsubscribeFromPush()
        setPushSubscribed(false)
        toast.success(t('transfer.push_off_toast'))
      } else {
        await subscribeToPush(user.id)
        setPushSubscribed(true)
        toast.success(t('transfer.push_on_toast'))
      }
    } catch (err) {
      console.error('[TransferPage] push toggle error:', err)
      toast.error((err as Error).message || t('transfer.push_error_toast'))
    } finally {
      setPushBusy(false)
    }
  }

  const getMessageDraft = (a: { id: string; adminMessage: string }) =>
    messageDrafts[a.id] !== undefined ? messageDrafts[a.id] : a.adminMessage

  const setMessageDraft = (id: string, value: string) =>
    setMessageDrafts((prev) => ({ ...prev, [id]: value }))

  const handleSaveMessage = async (id: string) => {
    setSavingMessageId(id)
    await updateAdminMessage(id, messageDrafts[id] ?? '')
    setSavingMessageId(null)
    // 저장 후 draft 제거 (다시 a.adminMessage 가 표시되도록)
    setMessageDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleStatusChange = async (id: string, status: TransferStatus) => {
    if (!user) return
    const draft = messageDrafts[id]
    // 메시지가 수정되었으면 함께 저장, 아니면 상태만 변경
    await updateStatus(id, status, user.id, draft !== undefined ? draft : undefined)
    setMessageDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  // 등급 편집 (관리자만)
  const [tierEditMode, setTierEditMode] = useState(false)
  const [tierDraft, setTierDraft] = useState<TierDraftForm | null>(null)
  const [tierSaving, setTierSaving] = useState(false)
  const [deleteTierId, setDeleteTierId] = useState<string | null>(null)

  useEffect(() => {
    // 등급 옵션은 게스트 신청 폼에도 노출돼야 하므로 항상 로드
    loadTiers()
    if (isAdmin) {
      loadAll()
    }
  }, [isAdmin, loadAll, loadTiers])

  // 게스트 신청 폼 로직은 TransferSubmitForm 컴포넌트로 분리됨.

  // ── 등급 편집 핸들러 ──
  const startEditTier = (id: string) => {
    const tier = tiers.find((t) => t.id === id)
    if (!tier) return
    setTierDraft({
      id: tier.id,
      name: tier.name,
      minCpStr: tier.minCp > 0 ? formatCp(tier.minCp) : '',
      maxCpStr: tier.maxCp != null ? formatCp(tier.maxCp) : '',
      capacityStr: String(tier.capacity),
      sortOrderStr: String(tier.sortOrder),
      seasonName: tier.seasonName,
    })
  }

  const startNewTier = () => {
    const nextOrder = tiers.length > 0 ? Math.max(...tiers.map((x) => x.sortOrder)) + 1 : 1
    setTierDraft({ ...EMPTY_TIER_DRAFT, sortOrderStr: String(nextOrder) })
  }

  const saveTier = async () => {
    if (!tierDraft || tierSaving) return
    setTierSaving(true)
    const ok = await upsertTier({
      id: tierDraft.id,
      name: tierDraft.name.trim(),
      minCp: parseTierInput(tierDraft.minCpStr) ?? 0,
      maxCp: parseTierInput(tierDraft.maxCpStr),
      capacity: parseInt(tierDraft.capacityStr, 10) || 0,
      sortOrder: parseInt(tierDraft.sortOrderStr, 10) || 0,
      seasonName: tierDraft.seasonName,
    })
    setTierSaving(false)
    if (ok) setTierDraft(null)
  }

  // 신청서의 effective tier:
  //   1) 사용자가 직접 선택한 tier_id 가 있으면 그것
  //   2) 없으면 CP 기반 자동 매칭
  const getEffectiveTier = (a: typeof apps[number]) => {
    if (a.tierId) return tiers.find((tt) => tt.id === a.tierId) ?? null
    return findTierForCp(tiers, parseCp(a.cp))
  }

  const filtered = apps.filter((a) => {
    if (a.status !== tab) return false
    if (allianceFilter !== 'all' && a.desiredAlliance !== allianceFilter) return false
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      const hit = a.inGameName.toLowerCase().includes(q) || (a.uid ?? '').toLowerCase().includes(q)
      if (!hit) return false
    }
    if (tierFilter !== 'all') {
      const tier = getEffectiveTier(a)
      if (tierFilter === 'unmatched') {
        if (tier) return false
      } else if (tier?.id !== tierFilter) {
        return false
      }
    }
    return true
  })

  // 동맹별 통계 (전체 apps 기준 — 현재 탭과 무관하게 표시)
  const allianceStats = useMemo(() => {
    const stats: Record<string, number> = { ONE: 0, NXO: 0, NH_D: 0, OTHER: 0 }
    for (const a of apps) {
      if (a.desiredAlliance in stats) stats[a.desiredAlliance] += 1
    }
    return stats
  }, [apps])
  const counts = {
    PENDING: apps.filter((a) => a.status === 'PENDING').length,
    APPROVED: apps.filter((a) => a.status === 'APPROVED').length,
    REJECTED: apps.filter((a) => a.status === 'REJECTED').length,
  }

  // 승인된 신청자들의 등급별 집계 + 잔여/종합 통계
  // tier_id 가 있으면 그것 우선, 없으면 CP 기반 자동 매칭
  const approvedByTier = useMemo(() => {
    const map = new Map<string, number>()
    const unmatchedApps: typeof apps = []
    for (const a of apps) {
      if (a.status !== 'APPROVED') continue
      const tier = a.tierId
        ? tiers.find((tt) => tt.id === a.tierId) ?? null
        : findTierForCp(tiers, parseCp(a.cp))
      if (tier) map.set(tier.id, (map.get(tier.id) ?? 0) + 1)
      else unmatchedApps.push(a)
    }
    const totalCapacity = tiers.reduce((sum, t) => sum + (t.capacity || 0), 0)
    const totalApproved = Array.from(map.values()).reduce((sum, n) => sum + n, 0)
    const totalRemaining = Math.max(0, totalCapacity - totalApproved)
    return {
      map,
      unmatched: unmatchedApps.length,
      unmatchedApps,
      totalCapacity,
      totalApproved,
      totalRemaining,
    }
  }, [apps, tiers])

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

      {/* 이미 신청한 사람을 위한 조회 링크 — 게스트에게만 */}
      {isGuest && (
        <div className="max-w-xl flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] -mt-1">
          <span className="text-xs text-[var(--color-text-muted)]">{t('transfer.status_link_label')}</span>
          <button
            onClick={() => navigate('/transfer/status')}
            className="text-xs font-semibold text-[var(--color-brand)] hover:underline whitespace-nowrap"
          >
            {t('transfer.status_link_btn')}
          </button>
        </div>
      )}

      {/* 게스트 신청 폼 — 본인/단체 토글 */}
      {isGuest && <TransferSubmitForm />}


      {/* 관리자 전용: 신청서 목록 */}
      {isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">{t('transfer.admin_list_title')}</h2>
            <div className="flex items-center gap-2">
              {pushSupported && (
                <button
                  onClick={handleTogglePush}
                  disabled={pushBusy}
                  title={pushSubscribed ? t('transfer.push_off_btn') : t('transfer.push_on_btn')}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors',
                    pushSubscribed
                      ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/25'
                      : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                    pushBusy && 'opacity-50',
                  )}
                >
                  {pushBusy
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : pushSubscribed
                      ? <Bell className="w-3 h-3" />
                      : <BellOff className="w-3 h-3" />}
                  {pushSubscribed ? t('transfer.push_on_label') : t('transfer.push_off_label')}
                </button>
              )}
              <button onClick={() => loadAll(true)} className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                <RotateCcw className="w-3 h-3" /> {t('common.search')}
              </button>
            </div>
          </div>

          {/* 등급별 정원 대시보드 + 인라인 편집 */}
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[var(--color-brand)]" />
                {tierEditMode ? t('tiers.title') : t('transfer.dashboard_title')}
              </h3>
              <div className="flex items-center gap-2">
                {!tierEditMode && (
                  <span className="text-[11px] text-[var(--color-text-muted)]">{t('transfer.dashboard_hint')}</span>
                )}
                <button
                  onClick={() => setTierEditMode((v) => !v)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors',
                    tierEditMode
                      ? 'bg-[var(--color-brand)] text-white'
                      : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]',
                  )}
                >
                  {tierEditMode ? <CheckCircle2 className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                  {tierEditMode ? t('common.close') : t('transfer.edit_tiers_btn')}
                </button>
              </div>
            </div>

            {/* 종합 요약 (편집 모드 아닐 때만) — 모바일에서도 4열 유지하여 세로 길이 단축 */}
            {!tierEditMode && tiers.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3 pb-3 border-b border-[var(--color-border-subtle)]">
                <div className="text-center px-1">
                  <p className="text-[9px] sm:text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider truncate">{t('transfer.summary_capacity')}</p>
                  <p className="text-sm sm:text-base font-bold text-[var(--color-text-primary)]">{approvedByTier.totalCapacity}</p>
                </div>
                <div className="text-center px-1">
                  <p className="text-[9px] sm:text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider truncate">{t('transfer.summary_approved')}</p>
                  <p className="text-sm sm:text-base font-bold text-[var(--color-success)]">{approvedByTier.totalApproved}</p>
                </div>
                <div className="text-center px-1">
                  <p className="text-[9px] sm:text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider truncate">{t('transfer.summary_remaining')}</p>
                  <p className="text-sm sm:text-base font-bold text-[var(--color-brand)]">{approvedByTier.totalRemaining}</p>
                </div>
                <div className="text-center px-1">
                  <p className="text-[9px] sm:text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider truncate">{t('transfer.dashboard_unmatched')}</p>
                  <p className={cn('text-sm sm:text-base font-bold', approvedByTier.unmatched > 0 ? 'text-yellow-400' : 'text-[var(--color-text-muted)]')}>
                    {approvedByTier.unmatched}
                  </p>
                </div>
              </div>
            )}

            {/* 미매칭 안내 (등급 범위가 신청자 CP를 못 커버할 때) */}
            {!tierEditMode && approvedByTier.unmatched > 0 && approvedByTier.unmatchedApps.length > 0 && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                <p className="text-[11px] text-yellow-300 mb-1 font-semibold">{t('transfer.unmatched_hint')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {approvedByTier.unmatchedApps.slice(0, 8).map((a) => (
                    <span key={a.id} className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-400/15 text-yellow-200">
                      {a.inGameName} · {a.cp || '?'}
                    </span>
                  ))}
                  {approvedByTier.unmatchedApps.length > 8 && (
                    <span className="text-[10px] text-yellow-400/60">+{approvedByTier.unmatchedApps.length - 8}</span>
                  )}
                </div>
              </div>
            )}

            {tiers.length === 0 && !tierEditMode ? (
              <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">{t('tiers.no_data')}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {tiers.map((tier) => {
                  if (tierEditMode) {
                    return (
                      <div key={tier.id} className="group bg-[var(--color-bg-base)] rounded-lg p-2.5 border border-[var(--color-border-subtle)] hover:border-[var(--color-brand)]/40 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{tier.name}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditTier(tier.id)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-brand)]">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => setDeleteTierId(tier.id)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-[var(--color-text-muted)]">{formatTierRange(tier.minCp, tier.maxCp)}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">{t('tiers.capacity')}: {tier.capacity}</p>
                      </div>
                    )
                  }
                  const cur = approvedByTier.map.get(tier.id) ?? 0
                  const cap = tier.capacity
                  const remaining = Math.max(0, cap - cur)
                  const pct = cap > 0 ? Math.min(100, (cur / cap) * 100) : 0
                  const over = cap > 0 && cur > cap
                  const full = cap > 0 && cur >= cap && !over
                  return (
                    <div key={tier.id} className="bg-[var(--color-bg-base)] rounded-lg p-2 sm:p-2.5">
                      <div className="flex items-center justify-between mb-1 gap-1">
                        <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-text-primary)] truncate">{tier.name}</span>
                        <span className={cn(
                          'text-[10px] sm:text-[11px] font-bold flex-shrink-0',
                          over ? 'text-[var(--color-danger)]' : full ? 'text-yellow-400' : 'text-[var(--color-text-secondary)]',
                        )}>
                          {cur}/{cap}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden mb-1">
                        <div
                          className={cn(
                            'h-full transition-all',
                            over ? 'bg-[var(--color-danger)]' : full ? 'bg-yellow-400' : 'bg-[var(--color-brand)]',
                          )}
                          style={{ width: `${over ? 100 : pct}%` }}
                        />
                      </div>
                      <p className={cn(
                        'text-[9px] sm:text-[10px] font-medium text-center truncate',
                        over ? 'text-[var(--color-danger)]' : full ? 'text-yellow-400' : 'text-[var(--color-text-muted)]',
                      )}>
                        {over
                          ? t('transfer.tier_over', { n: cur - cap })
                          : full
                            ? t('transfer.tier_full')
                            : t('transfer.tier_remaining', { n: remaining })}
                      </p>
                    </div>
                  )
                })}
                {tierEditMode && tiers.length < MAX_TIERS && (
                  <button
                    onClick={startNewTier}
                    className="bg-[var(--color-bg-base)] rounded-lg p-2.5 border border-dashed border-[var(--color-border)] hover:border-[var(--color-brand)] hover:bg-[var(--color-bg-elevated)] transition-colors flex items-center justify-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-brand)]"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-xs font-semibold">{t('tiers.add_btn')}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 검색 + 등급 필터 */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('transfer.search_placeholder')}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-brand)]"
              />
            </div>
            {tiers.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setTierFilter('all')}
                  className={cn(
                    'px-2.5 py-1 rounded text-[11px] font-semibold transition-colors',
                    tierFilter === 'all'
                      ? 'bg-[var(--color-brand)] text-white'
                      : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]',
                  )}
                >
                  {t('transfer.filter_all')}
                </button>
                {tiers.map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setTierFilter(tier.id)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[11px] font-semibold transition-colors',
                      tierFilter === tier.id
                        ? 'bg-[var(--color-brand)] text-white'
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]',
                    )}
                  >
                    {tier.name}
                  </button>
                ))}
                <button
                  onClick={() => setTierFilter('unmatched')}
                  className={cn(
                    'px-2.5 py-1 rounded text-[11px] font-semibold transition-colors',
                    tierFilter === 'unmatched'
                      ? 'bg-yellow-400 text-black'
                      : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]',
                  )}
                >
                  {t('transfer.filter_unmatched')}
                </button>
              </div>
            )}
            {/* 동맹별 필터 칩 */}
            <div className="flex gap-1 flex-wrap">
              {(['all', 'ONE', 'NXO', 'NH_D', 'OTHER'] as const).map((code) => (
                <button
                  key={code}
                  onClick={() => setAllianceFilter(code)}
                  className={cn(
                    'px-2.5 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1',
                    allianceFilter === code
                      ? 'bg-[var(--color-brand)] text-white'
                      : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]',
                  )}
                >
                  {code === 'all'
                    ? t('transfer.filter_all')
                    : code === 'NH_D'
                      ? 'NH-D'
                      : code === 'OTHER'
                        ? t('transfer.alliance_other')
                        : code}
                  {code !== 'all' && (
                    <span className="text-[9px] opacity-70">{allianceStats[code] ?? 0}</span>
                  )}
                </button>
              ))}
            </div>
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
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate">{a.inGameName}</h3>
                          {/* 희망 동맹 배지 */}
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)] flex-shrink-0">
                            → {a.desiredAlliance === 'OTHER'
                              ? (a.desiredAllianceOther || t('transfer.alliance_other'))
                              : a.desiredAlliance === 'NH_D' ? 'NH-D' : a.desiredAlliance}
                          </span>
                          {/* 단체 신청 배지 */}
                          {a.groupId && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 flex-shrink-0">
                              {t('transfer.group_badge')}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                          {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={cn('flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded flex-shrink-0', meta.bg, meta.color)}>
                        <Icon className="w-3 h-3" />
                        {t(`transfer.status_${a.status.toLowerCase()}`)}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-[var(--color-text-secondary)] mb-3">
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_uid')}</span>
                        <span className="text-[var(--color-text-primary)] font-mono">{a.uid || '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_server')}</span>
                        <span className="text-[var(--color-text-primary)]">{a.currentServer || '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_country')}</span>
                        <span className="text-[var(--color-text-primary)]">
                          {a.country
                            ? (COUNTRY_OPTIONS.includes(a.country as typeof COUNTRY_OPTIONS[number])
                                ? `${COUNTRY_FLAGS[a.country]} ${t(`transfer.country_${a.country.toLowerCase()}`)}`
                                : a.country)
                            : '—'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_tier')}</span>
                        <span className="text-[var(--color-text-primary)] flex items-center gap-1.5 flex-wrap">
                          {(() => {
                            const userTier = a.tierId ? tiers.find((tt) => tt.id === a.tierId) : null
                            return userTier ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)]">{userTier.name}</span>
                            ) : (
                              <span className="text-[var(--color-text-muted)]">—</span>
                            )
                          })()}
                          {tiers.length > 0 && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setAdminTierEditId((cur) => (cur === a.id ? null : a.id))}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors"
                              >
                                {t('transfer.tier_edit_btn')}
                              </button>
                              {adminTierEditId === a.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setAdminTierEditId(null)} />
                                  <div className="absolute left-0 mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-xl overflow-hidden z-20 min-w-[140px]">
                                    <button
                                      type="button"
                                      onClick={async () => { await updateTier(a.id, null); setAdminTierEditId(null) }}
                                      className={cn(
                                        'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left',
                                        !a.tierId ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] font-semibold' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]',
                                      )}
                                    >
                                      <span className="flex-1">{t('transfer.tier_none')}</span>
                                    </button>
                                    {tiers.map((tier) => (
                                      <button
                                        key={tier.id}
                                        type="button"
                                        onClick={async () => { await updateTier(a.id, tier.id); setAdminTierEditId(null) }}
                                        className={cn(
                                          'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left',
                                          a.tierId === tier.id ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] font-semibold' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]',
                                        )}
                                      >
                                        <span className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />
                                        <span className="flex-1">{tier.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_cp')}</span>
                        <span className="text-[var(--color-text-primary)] flex items-center gap-1.5">
                          {a.cp || '—'}
                          {(() => {
                            const tier = findTierForCp(tiers, parseCp(a.cp))
                            return tier
                              ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]" title={t('transfer.cp_suggested_tooltip')}>~ {tier.name}</span>
                              : null
                          })()}
                        </span>
                      </div>
                    </div>

                    {/* 신청자에게 보여줄 메시지 */}
                    <div className="pt-3 border-t border-[var(--color-border-subtle)]">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)]">
                          {t('transfer.admin_message_label')}
                        </label>
                        {messageDrafts[a.id] !== undefined && messageDrafts[a.id] !== a.adminMessage && (
                          <button
                            onClick={() => handleSaveMessage(a.id)}
                            disabled={savingMessageId === a.id}
                            className="text-[10px] font-semibold text-[var(--color-brand)] hover:underline disabled:opacity-50"
                          >
                            {savingMessageId === a.id
                              ? <Loader2 className="w-3 h-3 animate-spin inline" />
                              : t('common.save')}
                          </button>
                        )}
                      </div>
                      <textarea
                        value={getMessageDraft(a)}
                        onChange={(e) => setMessageDraft(a.id, e.target.value)}
                        placeholder={t('transfer.admin_message_placeholder')}
                        rows={2}
                        className="w-full px-2 py-1.5 text-xs rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-brand)] resize-none"
                      />
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{t('transfer.admin_message_hint')}</p>
                    </div>

                    {/* 액션 버튼 — 클릭 시 메시지도 함께 저장됨 */}
                    <div className="flex gap-2 pt-3">
                      {a.status !== 'APPROVED' && (
                        <button
                          onClick={() => handleStatusChange(a.id, 'APPROVED')}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" /> {t('transfer.approve_btn')}
                        </button>
                      )}
                      {a.status !== 'REJECTED' && (
                        <button
                          onClick={() => handleStatusChange(a.id, 'REJECTED')}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold bg-[var(--color-danger)]/15 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/25 transition-colors"
                        >
                          <XCircle className="w-3 h-3" /> {t('transfer.reject_btn')}
                        </button>
                      )}
                      {a.status !== 'PENDING' && (
                        <button
                          onClick={() => handleStatusChange(a.id, 'PENDING')}
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

      {/* TIER 추가/수정 모달 */}
      {tierDraft && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold">{tierDraft.id ? t('tiers.edit_title') : t('tiers.add_title')}</h2>
              <button onClick={() => setTierDraft(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] -mr-1 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_name')} *</label>
              <Input value={tierDraft.name} onChange={(e) => setTierDraft({ ...tierDraft, name: e.target.value })} placeholder="T1, T2, ..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_min_cp')}</label>
                <Input value={tierDraft.minCpStr} onChange={(e) => setTierDraft({ ...tierDraft, minCpStr: e.target.value })} placeholder="3G" />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_max_cp')}</label>
                <Input value={tierDraft.maxCpStr} onChange={(e) => setTierDraft({ ...tierDraft, maxCpStr: e.target.value })} placeholder={t('tiers.unlimited_placeholder')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_capacity')} *</label>
                <Input type="number" value={tierDraft.capacityStr} onChange={(e) => setTierDraft({ ...tierDraft, capacityStr: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_sort_order')}</label>
                <Input type="number" value={tierDraft.sortOrderStr} onChange={(e) => setTierDraft({ ...tierDraft, sortOrderStr: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_season')}</label>
              <Input value={tierDraft.seasonName} onChange={(e) => setTierDraft({ ...tierDraft, seasonName: e.target.value })} placeholder={t('tiers.season_placeholder')} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="full" onClick={() => setTierDraft(null)}>{t('common.cancel')}</Button>
              <Button size="full" disabled={!tierDraft.name.trim() || tierSaving} onClick={saveTier}>
                {tierSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TIER 삭제 확인 모달 */}
      {deleteTierId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />
              </div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('tiers.delete_title')}</h2>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('tiers.delete_desc')}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="full" onClick={() => setDeleteTierId(null)}>{t('common.cancel')}</Button>
              <Button size="full" className="bg-[var(--color-danger)] hover:bg-red-700 text-white"
                onClick={async () => { await removeTier(deleteTierId); setDeleteTierId(null) }}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
