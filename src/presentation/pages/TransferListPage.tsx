// 이주 신청 내역 — 게스트도 볼 수 있는 공개 조회 페이지.
// 권한 분리(다른 동맹 관리자 권한) 대신 모두 게스트로 볼 수 있게 단순화.
//
// 표시:
//  - 단체 신청: 대표자 카드 + 멤버 펼침
//  - 단독 신청: 개별 카드
//  - 거절은 RLS 가 자동 필터링 (대기/승인만)
//  - admin_message 비공개 (store.loadPublic 이 비워서 반환)

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ChevronDown, Users, User, Clock, CheckCircle2, ChevronRight, Filter, X, MessageSquare, Settings, Ticket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useTransferStore } from '@/infrastructure/stores/transferStore'
import { useTransferTierStore, findTierForCp } from '@/infrastructure/stores/transferTierStore'
import type { DesiredAlliance, TransferApplication, TransferStatus } from '@/domain/entities/Transfer'
import { TIER_COLOR_CLASS } from '@/domain/entities/TransferTier'
import type { TransferTier } from '@/domain/entities/TransferTier'
import { parseCp } from '@/lib/cp'
import { Button } from '@/presentation/components/ui/button'
import { cn } from '@/lib/utils'

const ALLIANCE_FILTERS: Array<{ code: 'ALL' | DesiredAlliance; label: string }> = [
  { code: 'ALL', label: 'all' },
  { code: 'ONE', label: 'ONE' },
  { code: 'NXO', label: 'NXO' },
  { code: 'NH_D', label: 'NH-D' },
  { code: 'OTHER', label: 'other' },
]

const STATUS_META: Record<Exclude<TransferStatus, 'REJECTED'>, { icon: typeof Clock; color: string; bg: string }> = {
  PENDING: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
  APPROVED: { icon: CheckCircle2, color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/15' },
}

const COUNTRY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', VN: '🇻🇳', TW: '🇹🇼', CN: '🇨🇳', JP: '🇯🇵', EN: '🇺🇸', OTHER: '🌐',
}

export const TransferListPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ROLE_ADMIN'
  const { apps, groups, loading, loadPublic, loadAll } = useTransferStore()
  const { tiers, loadAll: loadTiers } = useTransferTierStore()

  const [filter, setFilter] = useState<'ALL' | DesiredAlliance>('ALL')
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  // 관리자 상세 모달 — 클릭한 신청서
  const [detail, setDetail] = useState<TransferApplication | null>(null)

  useEffect(() => {
    // 관리자는 admin_message 등 전체 정보 필요 → loadAll, 그 외 게스트 공개 조회 → loadPublic
    if (isAdmin) loadAll(true)
    else loadPublic(true)
    loadTiers()
  }, [isAdmin, loadAll, loadPublic, loadTiers])

  // 필터 적용 후 그룹/단독 분리
  const { groupItems, soloItems } = useMemo(() => {
    const matchAlliance = (a: { desiredAlliance: DesiredAlliance }) =>
      filter === 'ALL' || a.desiredAlliance === filter

    const filteredGroups = groups.filter(matchAlliance)
    const groupIds = new Set(filteredGroups.map((g) => g.id))

    // 그룹에 속한 신청들 (그 그룹의 멤버)
    const groupItems = filteredGroups.map((g) => {
      const members = apps.filter((a) => a.groupId === g.id)
      return { group: g, members }
    })

    // 단독 (group_id 가 없거나, 필터에 해당하는 단독)
    const soloItems = apps.filter((a) => {
      if (a.groupId) {
        // 필터된 그룹의 멤버는 위에서 표시했으니 skip
        return false
      }
      return matchAlliance(a)
    })

    // 그룹 멤버는 위 groupItems 안에서만 노출되도록 단독에서 제외
    void groupIds
    return { groupItems, soloItems }
  }, [apps, groups, filter])

  // 등급명: tier_id(관리자 지정) 우선, 없으면 합산 전투력(total_power) 매칭
  const tierName = (a: { tierId: string | null; totalPower: string }): string | null => {
    const tier = a.tierId
      ? tiers.find((tt) => tt.id === a.tierId) ?? null
      : a.totalPower.trim()
        ? findTierForCp(tiers, parseCp(a.totalPower))
        : null
    return tier?.name ?? null
  }

  const allianceLabel = (a: DesiredAlliance, other: string) => {
    if (a === 'OTHER') return other || t('transfer.alliance_other')
    if (a === 'NH_D') return 'NH-D'
    return a
  }

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-4 break-keep">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('transfer_list.title')}</h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">{t('transfer_list.subtitle')}</p>
        </div>
        <button
          onClick={() => navigate('/transfer')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-brand)] text-white text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {t('transfer_list.go_submit')}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 티켓 등급 잔여 현황 */}
      <TierSlotsPanel apps={apps} tiers={tiers} />

      {/* 동맹 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
        {ALLIANCE_FILTERS.map((f) => (
          <button
            key={f.code}
            onClick={() => setFilter(f.code)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              filter === f.code
                ? 'bg-[var(--color-brand)] text-white'
                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]',
            )}
          >
            {f.code === 'ALL'
              ? t('transfer_list.filter_all')
              : f.code === 'OTHER'
                ? t('transfer.alliance_other')
                : f.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading && apps.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : groupItems.length === 0 && soloItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2 text-[var(--color-text-muted)]">
          <Users className="w-10 h-10 opacity-30" />
          <p className="text-sm">{t('transfer_list.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 그룹 카드 */}
          {groupItems.map(({ group, members }) => {
            const isOpen = expandedGroupId === group.id
            return (
              <div key={group.id} className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedGroupId(isOpen ? null : group.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-bg-elevated)] transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--color-brand)]/15 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-[var(--color-brand)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {t('transfer_list.group_card_title', { leader: group.leaderName, count: members.length })}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
                        {allianceLabel(group.desiredAlliance, group.desiredAllianceOther)}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {new Date(group.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-[var(--color-text-muted)] transition-transform flex-shrink-0', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--color-border-subtle)] divide-y divide-[var(--color-border-subtle)]">
                    {members.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-[var(--color-text-muted)] text-center">
                        {t('transfer_list.no_visible_members')}
                      </p>
                    ) : (
                      members.map((m, i) => (
                        <ApplicantRow
                          key={m.id}
                          idx={i}
                          app={m}
                          tierName={tierName(m)}
                          onClick={isAdmin ? () => setDetail(m) : undefined}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* 단독 카드 */}
          {soloItems.map((a) => (
            <div
              key={a.id}
              onClick={isAdmin ? () => setDetail(a) : undefined}
              className={cn(
                'bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl',
                isAdmin && 'cursor-pointer hover:border-[var(--color-brand)]/40 transition-colors',
              )}
            >
              <div className="px-4 py-3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-[var(--color-text-secondary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{a.inGameName}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
                      {allianceLabel(a.desiredAlliance, a.desiredAllianceOther)}
                    </span>
                    <StatusBadge status={a.status} />
                    {tierName(a) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]">
                        {tierName(a)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    UID: <span className="font-mono">{a.uid || '—'}</span>
                    {a.country && (
                      <span className="ml-2">{COUNTRY_FLAGS[a.country] ?? ''}</span>
                    )}
                  </p>
                </div>
                {isAdmin && <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0 mt-1" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 관리자 상세 모달 */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div
            className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--color-text-primary)] truncate">{detail.inGameName}</h2>
              <button onClick={() => setDetail(null)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 상태/동맹 배지 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatusBadge status={detail.status} />
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
                → {allianceLabel(detail.desiredAlliance, detail.desiredAllianceOther)}
              </span>
              {tierName(detail) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]">
                  {tierName(detail)}
                </span>
              )}
            </div>

            {/* 상세 정보 */}
            <div className="space-y-1.5 text-xs text-[var(--color-text-secondary)]">
              <DetailRow label={t('transfer.field_uid')} value={detail.uid || '—'} mono />
              <DetailRow label={t('transfer.field_server')} value={detail.currentServer || '—'} />
              <DetailRow
                label={t('transfer.field_country')}
                value={detail.country ? `${COUNTRY_FLAGS[detail.country] ?? ''} ${detail.country}` : '—'}
              />
              <DetailRow label={t('transfer.field_total_power')} value={detail.totalPower || '—'} />
              <DetailRow label={t('transfer.field_cp')} value={detail.cp || '—'} />
              <DetailRow label={t('transfer_status.submitted_at')} value={new Date(detail.createdAt).toLocaleString()} />
            </div>

            {/* 관리자 메시지 */}
            {detail.adminMessage && (
              <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[var(--color-brand)]" />
                  <p className="text-[11px] font-semibold text-[var(--color-brand)]">{t('transfer_status.admin_message_label')}</p>
                </div>
                <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed break-words">
                  {detail.adminMessage}
                </p>
              </div>
            )}

            {/* 관리 페이지로 이동 */}
            <Button size="full" onClick={() => navigate('/transfer')}>
              <Settings className="w-4 h-4" />
              {t('transfer_list.go_manage')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// 상세 모달 한 줄
const DetailRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex gap-2">
    <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{label}</span>
    <span className={cn('text-[var(--color-text-primary)] break-all', mono && 'font-mono')}>{value}</span>
  </div>
)

// ─────────────────────────────────────────────────────────
// ApplicantRow — 그룹 안의 한 명 표시
// ─────────────────────────────────────────────────────────

interface ApplicantRowProps {
  idx: number
  app: TransferApplication
  tierName: string | null
  onClick?: () => void
}

const ApplicantRow = ({ idx, app, tierName, onClick }: ApplicantRowProps) => {
  return (
    <div
      onClick={onClick}
      className={cn('flex items-center gap-3 px-4 py-2.5', onClick && 'cursor-pointer hover:bg-[var(--color-bg-elevated)] transition-colors')}
    >
      <span className="text-[11px] font-mono text-[var(--color-text-muted)] w-6 flex-shrink-0">#{idx + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{app.inGameName}</p>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">
          UID: <span className="font-mono">{app.uid || '—'}</span>
          {tierName && <span className="ml-2">· {tierName}</span>}
          {app.country && <span className="ml-2">{COUNTRY_FLAGS[app.country] ?? ''}</span>}
        </p>
      </div>
      <StatusBadge status={app.status} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// TierSlotsPanel — 티켓 등급 잔여 현황 (게스트 공개)
// ─────────────────────────────────────────────────────────

interface TierSlotsPanelProps {
  apps: TransferApplication[]
  tiers: TransferTier[]
}

const TierSlotsPanel = ({ apps, tiers }: TierSlotsPanelProps) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)

  // 등급별 승인 인원 집계 (tierId 기준)
  const approvedByTier = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of apps) {
      if (a.status === 'APPROVED' && a.tierId) {
        map.set(a.tierId, (map.get(a.tierId) ?? 0) + 1)
      }
    }
    return map
  }, [apps])

  if (tiers.length === 0) return null

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
          <Ticket className="w-4 h-4 text-[var(--color-brand)]" />
          {t('transfer_list.tier_slots')}
          <span className="text-[10px] font-normal text-[var(--color-text-muted)] ml-1">
            {t('transfer_list.tier_slots_hint')}
          </span>
        </h3>
        <ChevronDown className={cn('w-4 h-4 text-[var(--color-text-muted)] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {tiers.map((tier) => {
            const approved = approvedByTier.get(tier.id) ?? 0
            const remaining = tier.capacity - approved
            const pct = Math.min(100, (approved / tier.capacity) * 100)
            const isFull = remaining <= 0

            // Tailwind 퍼지 안전: 색상별 고정 클래스
            const badgeClass: Record<string, string> = {
              orange: 'bg-orange-500/30 text-orange-300',
              purple: 'bg-purple-500/30 text-purple-300',
              blue:   'bg-blue-500/30 text-blue-300',
              gray:   'bg-gray-500/30 text-gray-300',
            }
            const barClass: Record<string, string> = {
              orange: 'bg-orange-500',
              purple: 'bg-purple-500',
              blue:   'bg-blue-500',
              gray:   'bg-gray-500',
            }

            return (
              <div key={tier.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded', badgeClass[tier.color])}>
                      {tier.name}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      {approved} / {tier.capacity}
                    </span>
                  </div>
                  <span className={cn(
                    'text-[11px] font-bold flex-shrink-0',
                    isFull ? 'text-red-400' : 'text-[var(--color-success)]',
                  )}>
                    {isFull
                      ? t('transfer_list.tier_full')
                      : t('transfer_list.tier_remaining', { n: remaining })}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', isFull ? 'bg-red-500' : barClass[tier.color])}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// StatusBadge — 대기/승인만 (거절은 RLS 차단)
// ─────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: TransferStatus }) => {
  const { t } = useTranslation()
  if (status === 'REJECTED') return null  // 안전망
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span className={cn('flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0', meta.bg, meta.color)}>
      <Icon className="w-2.5 h-2.5" />
      {t(`transfer.status_${status.toLowerCase()}`)}
    </span>
  )
}
