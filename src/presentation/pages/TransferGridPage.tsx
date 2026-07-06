import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { RotateCcw, Search, MailCheck, Mail, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useTransferStore } from '@/infrastructure/stores/transferStore'
import { useTransferTierStore, findTierForCp } from '@/infrastructure/stores/transferTierStore'
import { parseCp } from '@/lib/cp'
import { CopyButton } from '@/presentation/components/ui/copy-button'
import { cn } from '@/lib/utils'
import { TIER_COLOR_CLASS } from '@/domain/entities/TransferTier'

type SortKey = 'server' | 'name' | 'uid' | 'invited' | 'tier' | 'group'
type SortDir = 'asc' | 'desc'

const SortIcon = ({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) => {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-[var(--color-brand)]" />
    : <ChevronDown className="w-3 h-3 text-[var(--color-brand)]" />
}

export const TransferGridPage = () => {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ROLE_ADMIN'

  const { apps, groups, loading, loadAll, setInvited } = useTransferStore()
  const { tiers, loadAll: loadTiers } = useTransferTierStore()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('APPROVED')
  const [inviteFilter, setInviteFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('server')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    loadTiers()
    loadAll()
  }, [loadAll, loadTiers])

  if (!isAdmin) return <Navigate to="/" replace />

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const groupName = (groupId: string | null) => {
    if (!groupId) return ''
    return groups.find((g) => g.id === groupId)?.leaderName ?? ''
  }

  const getTier = (app: typeof apps[number]) => {
    if (app.tierId) return tiers.find((t) => t.id === app.tierId) ?? null
    if (app.totalPower.trim()) return findTierForCp(tiers, parseCp(app.totalPower))
    return null
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return apps
      .filter((a) => {
        if (statusFilter !== 'ALL' && a.status !== statusFilter) return false
        if (inviteFilter === 'yes' && !a.invitedAt) return false
        if (inviteFilter === 'no' && a.invitedAt) return false
        if (q) {
          return (
            a.inGameName.toLowerCase().includes(q) ||
            a.uid.toLowerCase().includes(q) ||
            a.currentServer.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => {
        let va = '', vb = ''
        if (sortKey === 'server') { va = a.currentServer; vb = b.currentServer }
        else if (sortKey === 'name') { va = a.inGameName; vb = b.inGameName }
        else if (sortKey === 'uid') { va = a.uid; vb = b.uid }
        else if (sortKey === 'invited') { va = a.invitedAt ?? ''; vb = b.invitedAt ?? '' }
        else if (sortKey === 'group') { va = groupName(a.groupId); vb = groupName(b.groupId) }
        else if (sortKey === 'tier') {
          va = getTier(a)?.sortOrder?.toString() ?? '99'
          vb = getTier(b)?.sortOrder?.toString() ?? '99'
        }
        const cmp = va.localeCompare(vb, undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps, groups, tiers, search, statusFilter, inviteFilter, sortKey, sortDir])

  const invitedCount = rows.filter((a) => a.invitedAt).length

  const thClass = 'px-3 py-2.5 text-left text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider select-none cursor-pointer hover:text-[var(--color-text-primary)] transition-colors whitespace-nowrap'

  return (
    <div className="p-3 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">이주 진행 현황</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            초대 완료 {invitedCount} / {rows.length}명
          </p>
        </div>
        <button
          onClick={() => loadAll(true)}
          className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> 새로고침
        </button>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2">
        {/* 상태 필터 */}
        <div className="flex gap-1 p-1 bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border-subtle)]">
          {([['APPROVED', '승인'], ['PENDING', '대기'], ['ALL', '전체']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                statusFilter === v ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 초대 필터 */}
        <div className="flex gap-1 p-1 bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border-subtle)]">
          {([['all', '전체'], ['no', '미초대'], ['yes', '초대완료']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setInviteFilter(v)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                inviteFilter === v ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 검색 */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="인게임명 · UID · 서버 검색..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-brand)]"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-xl border border-[var(--color-border-subtle)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)]">
              <tr>
                <th className={thClass} onClick={() => handleSort('server')}>
                  <span className="flex items-center gap-1">서버 <SortIcon col="server" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className={thClass} onClick={() => handleSort('name')}>
                  <span className="flex items-center gap-1">인게임명 <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className={thClass} onClick={() => handleSort('uid')}>
                  <span className="flex items-center gap-1">UID <SortIcon col="uid" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className={thClass} onClick={() => handleSort('tier')}>
                  <span className="flex items-center gap-1">등급 <SortIcon col="tier" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className={thClass} onClick={() => handleSort('group')}>
                  <span className="flex items-center gap-1">단체 <SortIcon col="group" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th className={thClass} onClick={() => handleSort('invited')}>
                  <span className="flex items-center gap-1">초대 완료 <SortIcon col="invited" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-xs text-[var(--color-text-muted)]">불러오는 중...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-xs text-[var(--color-text-muted)]">신청서가 없습니다.</td>
                </tr>
              ) : rows.map((a) => {
                const tier = getTier(a)
                const gName = groupName(a.groupId)
                return (
                  <tr key={a.id} className={cn(
                    'transition-colors hover:bg-[var(--color-bg-elevated)]',
                    a.invitedAt && 'opacity-50',
                  )}>
                    {/* 서버 */}
                    <td className="px-3 py-2.5 text-xs font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                      {a.currentServer || '—'}
                    </td>
                    {/* 인게임명 */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-[var(--color-text-primary)]">{a.inGameName}</span>
                        {a.status === 'APPROVED' && (
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[var(--color-success)]/15 text-[var(--color-success)]">승인</span>
                        )}
                        {a.status === 'PENDING' && (
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-yellow-400/15 text-yellow-400">대기</span>
                        )}
                      </div>
                    </td>
                    {/* UID */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-[var(--color-text-secondary)]">{a.uid || '—'}</span>
                        {a.uid && <CopyButton value={a.uid} />}
                      </div>
                    </td>
                    {/* 등급 */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {tier ? (
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', TIER_COLOR_CLASS[tier.color].badge)}>
                          {tier.name}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-muted)] text-xs">—</span>
                      )}
                    </td>
                    {/* 단체 */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {gName ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">{gName}</span>
                      ) : (
                        <span className="text-[var(--color-text-muted)] text-xs">—</span>
                      )}
                    </td>
                    {/* 초대 완료 */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setInvited(a.id, !a.invitedAt)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border',
                          a.invitedAt
                            ? 'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30 hover:bg-[var(--color-success)]/25'
                            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]',
                        )}
                      >
                        {a.invitedAt
                          ? <><MailCheck className="w-3.5 h-3.5" /> 완료</>
                          : <><Mail className="w-3.5 h-3.5" /> 미완료</>
                        }
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 하단 집계 */}
        {rows.length > 0 && (
          <div className="px-4 py-2.5 bg-[var(--color-bg-surface)] border-t border-[var(--color-border-subtle)] flex items-center gap-4 text-[11px] text-[var(--color-text-muted)]">
            <span>총 {rows.length}명</span>
            <span className="text-[var(--color-success)]">초대완료 {invitedCount}명</span>
            <span className="text-yellow-400">미초대 {rows.length - invitedCount}명</span>
          </div>
        )}
      </div>
    </div>
  )
}
