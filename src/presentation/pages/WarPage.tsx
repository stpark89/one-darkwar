import { useEffect, useState } from 'react'
import { Search, Plus, X, Loader2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWarStore, nextEntry } from '@/infrastructure/stores/warStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import type { WarTeam, WarRole } from '@/domain/entities/War'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { SortIcon, nextSortDir } from '@/presentation/components/ui/sort-icon'
import type { SortDir } from '@/presentation/components/ui/sort-icon'
import { cn } from '@/lib/utils'

const ENTRY_STYLE: Record<string, string> = {
  'A-CT': 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
  'A-DB': 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20',
  'B-CT': 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30',
  'B-DB': 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20',
}

const EntryCell = ({ team, role }: { team: string; role: string }) => {
  const key = `${team}-${role}`
  if (!team || !role) return <span className="text-[var(--color-text-muted)]">·</span>
  return (
    <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded', ENTRY_STYLE[key] ?? '')}>
      {team}·{role}
    </span>
  )
}

export const WarPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const canEdit = user?.role === 'ROLE_ADMIN'

  const {
    activeSeason, rounds, loading,
    searchQuery, setSearchQuery,
    filterTeam, setFilterTeam,
    getMemberRows, getSummary,
    addRound, deleteRound, updateEntry, loadData,
  } = useWarStore()

  const baseMemberRows = getMemberRows()
  const summary = getSummary()
  const [activeTab, setActiveTab] = useState<'grid' | 'summary'>('grid')
  const [showAddRound, setShowAddRound] = useState(false)
  const [newRoundDate, setNewRoundDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<string>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: string) => {
    if (key !== sortKey) { setSortKey(key); setSortDir('desc'); return }
    const next = nextSortDir(sortDir, true)
    setSortDir(next)
    if (next === null) { setSortKey('total'); setSortDir('desc') }
  }

  const entryScore = (team: string, role: string) => {
    if (!team || !role) return 0
    if (team === 'A' && role === 'CT') return 4
    if (team === 'A' && role === 'DB') return 3
    if (team === 'B' && role === 'CT') return 2
    return 1
  }

  const memberRows = [...baseMemberRows].sort((a, b) => {
    if (!sortDir) return 0
    let cmp = 0
    if (sortKey === 'inGameName') cmp = a.inGameName.localeCompare(b.inGameName)
    else if (sortKey === 'total') cmp = a.total - b.total
    else {
      const ea = a.entryMap[sortKey] ?? { team: '', role: '' }
      const eb = b.entryMap[sortKey] ?? { team: '', role: '' }
      cmp = entryScore(ea.team, ea.role) - entryScore(eb.team, eb.role)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  useEffect(() => { loadData() }, [loadData])

  if (loading && rounds.length === 0) return (
    <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
    </div>
  )

  const handleCellClick = (roundId: string, memberId: string, team: string, role: string) => {
    const [nextTeam, nextRole] = nextEntry(team, role)
    updateEntry(roundId, memberId, nextTeam as WarTeam, nextRole as WarRole)
  }

  const handleAddRound = async () => {
    await addRound(newRoundDate)
    setShowAddRound(false)
    setNewRoundDate(new Date().toISOString().slice(0, 10))
  }

  return (
    <div className="p-3 sm:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2 sm:gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('war.title')}</h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
            {activeSeason?.name} · {rounds.length}회차
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border-subtle)]">
            <button
              onClick={() => setActiveTab('grid')}
              className={cn('px-2.5 sm:px-3 py-1.5 rounded text-xs font-medium transition-colors',
                activeTab === 'grid' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]')}
            >
              {t('war.tab_grid')}
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={cn('px-2.5 sm:px-3 py-1.5 rounded text-xs font-medium transition-colors',
                activeTab === 'summary' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]')}
            >
              {t('war.tab_ranking')}
            </button>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setShowAddRound(true)}>
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('war.add_round_btn')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* 검색 + 팀 필터 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('war.search_placeholder')} className="pl-9" />
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs text-[var(--color-text-muted)]">{t('war.filter_team')}</span>
          {(['', 'A', 'B'] as const).map(team => (
            <button
              key={team}
              onClick={() => setFilterTeam(team)}
              className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors',
                filterTeam === team
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]')}
            >
              {team === '' ? t('war.team_all') : `Team ${team}`}
            </button>
          ))}
          <span className="text-xs text-[var(--color-text-muted)] ml-auto sm:ml-0">{memberRows.length}{t('common.count_people')}</span>
        </div>
      </div>

      {activeTab === 'grid' ? (
        <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-auto max-h-[calc(100vh-280px)]">
          <table className="text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)]">
                <th
                  onClick={() => handleSort('inGameName')}
                  className="px-3 py-3 text-left text-[var(--color-text-muted)] sticky left-0 bg-[var(--color-bg-surface)] min-w-[140px] whitespace-nowrap cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {t('war.col_name')}<SortIcon dir={sortKey === 'inGameName' ? sortDir : null} />
                </th>
                <th
                  onClick={() => handleSort('total')}
                  className="px-3 py-3 text-center text-[var(--color-text-muted)] min-w-[48px] whitespace-nowrap cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {t('war.col_total')}<SortIcon dir={sortKey === 'total' ? sortDir : null} />
                </th>
                {rounds.map(r => (
                  <th key={r.id} onClick={() => handleSort(r.id)} className="px-3 py-3 text-center text-[var(--color-text-muted)] min-w-[72px] group cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors">
                    <div className="text-[10px] font-normal">{r.date?.slice(5) ?? ''}</div>
                    <div className="font-semibold flex items-center justify-center gap-1">
                      {t('war.round', { n: r.sortOrder })}
                      <SortIcon dir={sortKey === r.id ? sortDir : null} />
                      {canEdit && <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(r.id) }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-danger)] hover:text-red-400 ml-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {memberRows.map(row => (
                <tr key={row.memberId} className="hover:bg-[var(--color-bg-surface)] transition-colors">
                  <td className="px-3 py-2.5 font-medium text-[var(--color-text-primary)] whitespace-nowrap sticky left-0 bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-surface)]">
                    {row.inGameName}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-[var(--color-success)] font-bold">
                      {filterTeam
                        ? Object.values(row.entryMap).filter(e => e.team === filterTeam && e.role !== '').length
                        : row.total}
                    </span>
                  </td>
                  {rounds.map(r => {
                    const e = row.entryMap[r.id] ?? { team: '', role: '' }
                    const visible = !filterTeam || e.team === filterTeam
                    return (
                      <td
                        key={r.id}
                        onClick={() => canEdit && handleCellClick(r.id, row.memberId, e.team, e.role)}
                        className={cn('px-3 py-2.5 text-center select-none transition-colors hover:bg-[var(--color-bg-elevated)]', canEdit && 'cursor-pointer')}
                      >
                        <EntryCell team={visible ? e.team : ''} role={visible ? e.role : ''} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-auto">
          {summary.filter(s => s.total > 0).map((s, i) => (
            <div key={s.memberId} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
              <span className={cn('text-lg font-black w-8 text-center',
                i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-[var(--color-text-muted)]')}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
              </span>
              <span className="flex-1 font-medium text-[var(--color-text-primary)] text-sm">{s.inGameName}</span>
              <span className="text-[var(--color-success)] font-bold text-sm">{t('war.ranking_total', { count: s.total })}</span>
              {s.ct > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">CT {s.ct}</span>}
              {s.db > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">DB {s.db}</span>}
              {s.teamA > 0 && <span className="text-[10px] text-[var(--color-text-muted)]">A:{s.teamA}</span>}
              {s.teamB > 0 && <span className="text-[10px] text-[var(--color-text-muted)]">B:{s.teamB}</span>}
            </div>
          ))}
        </div>
      )}

      {/* 회차 추가 모달 */}
      {showAddRound && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold">{t('war.add_round_title')}</h2>
              <button onClick={() => setShowAddRound(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('war.round_date_label')}</label>
              <Input type="date" value={newRoundDate} onChange={e => setNewRoundDate(e.target.value)} />
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" size="full" onClick={() => setShowAddRound(false)}>{t('common.cancel')}</Button>
              <Button size="full" onClick={handleAddRound}>{t('common.add')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* 회차 삭제 확인 모달 */}
      {deleteConfirmId && (() => {
        const round = rounds.find(r => r.id === deleteConfirmId)
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('war.delete_round_title')}</h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                    {t('war.round', { n: round?.sortOrder })} · {round?.date}
                  </p>
                </div>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('war.delete_round_confirm')}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="full" onClick={() => setDeleteConfirmId(null)}>{t('common.cancel')}</Button>
                <Button
                  size="full"
                  className="bg-[var(--color-danger)] hover:bg-red-700 text-white"
                  onClick={async () => {
                    await deleteRound(deleteConfirmId)
                    setDeleteConfirmId(null)
                  }}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
