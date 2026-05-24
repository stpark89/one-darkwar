import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Loader2, Save, RotateCcw, Plus, X, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useVsPointStore } from '@/infrastructure/stores/vsPointStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { SortIcon, nextSortDir } from '@/presentation/components/ui/sort-icon'
import type { SortDir } from '@/presentation/components/ui/sort-icon'
import { cn } from '@/lib/utils'

type VsPopoverState = {
  roundId: string
  memberId: string
  inputValue: string
  x: number
  y: number
} | null

export const VsPointPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const canEdit = user?.role === 'ROLE_ADMIN'

  const {
    activeSeason, rounds, vsPoints, members, loading,
    loadData, batchSaveVs, addRound, deleteRound,
  } = useVsPointStore()

  // VS 페이지 내 인게임명 검색 — BG 와 독립이라 local state 로 관리
  const [searchQuery, setSearchQuery] = useState('')

  const [pendingVs, setPendingVs] = useState<Map<string, string>>(new Map())
  const [isSavingVs, setIsSavingVs] = useState(false)
  const [vsPopover, setVsPopover] = useState<VsPopoverState>(null)
  const vsPopoverRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => { loadData() }, [loadData])

  const parseVsNum = (v: string) => { const n = parseFloat(v.replace(/,/g, '')); return isNaN(n) ? 0 : n }

  const vsRows = useMemo(() => {
    const rows = members.map(m => {
      const pointsMap: Record<string, string> = {}
      let totalVs = 0
      rounds.forEach(r => {
        const key = `${m.id}::${r.id}`
        const pending = pendingVs.get(key)
        const val = pending !== undefined ? pending : (vsPoints.find(v => v.roundId === r.id && v.memberId === m.id)?.points ?? '')
        pointsMap[r.id] = val
        totalVs += parseVsNum(val)
      })
      return { memberId: m.id, inGameName: m.inGameName, pointsMap, totalVs }
    })

    return rows.sort((a, b) => {
      if (!sortDir) return 0
      let cmp = 0
      if (sortKey === 'inGameName') cmp = a.inGameName.localeCompare(b.inGameName)
      else if (sortKey === 'total') cmp = a.totalVs - b.totalVs
      else cmp = parseVsNum(a.pointsMap[sortKey] ?? '') - parseVsNum(b.pointsMap[sortKey] ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [members, rounds, vsPoints, pendingVs, sortKey, sortDir])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (vsPopover && vsPopoverRef.current && !vsPopoverRef.current.contains(e.target as Node)) {
        setVsPopover(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [vsPopover])

  const openVsPopover = (e: React.MouseEvent, roundId: string, memberId: string) => {
    if (!canEdit) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const key = `${memberId}::${roundId}`
    const pending = pendingVs.get(key)
    const stored = vsPoints.find(v => v.roundId === roundId && v.memberId === memberId)
    const current = pending !== undefined ? pending : (stored?.points ?? '')
    setVsPopover({ roundId, memberId, inputValue: current, x: rect.left + rect.width / 2, y: rect.bottom + 4 })
  }

  const commitVsPopover = (roundId: string, memberId: string, value: string) => {
    const key = `${memberId}::${roundId}`
    const stored = vsPoints.find(v => v.roundId === roundId && v.memberId === memberId)
    const original = stored?.points ?? ''
    const resolved = value.trim()
    setPendingVs(prev => {
      const next = new Map(prev)
      if (resolved !== original) next.set(key, resolved)
      else next.delete(key)
      return next
    })
    setVsPopover(null)
  }

  const handleSaveVs = async () => {
    if (pendingVs.size === 0) return
    setIsSavingVs(true)
    const changes = Array.from(pendingVs.entries()).map(([key, points]) => {
      const [memberId, roundId] = key.split('::')
      return { roundId, memberId, points }
    })
    const ok = await batchSaveVs(changes)
    if (ok) setPendingVs(new Map())
    setIsSavingVs(false)
  }

  const handleDiscardVs = () => { setPendingVs(new Map()); setVsPopover(null) }

  const handleAddRound = async () => {
    await addRound(newRoundDate)
    setShowAddRound(false)
    setNewRoundDate(new Date().toISOString().slice(0, 10))
  }

  if (loading && rounds.length === 0) return (
    <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
    </div>
  )

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2 sm:gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('vsPoint.title')}</h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
            {activeSeason?.name ?? t('vsPoint.no_season')}
            {activeSeason && <> · {t('vsPoint.subtitle', { n: rounds.length })}</>}
          </p>
        </div>
        {canEdit && activeSeason && (
          <Button size="sm" onClick={() => setShowAddRound(true)}>
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('war.add_round_btn')}</span>
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('war.search_placeholder')} className="pl-9" />
        </div>
      </div>

      {/* Save bar */}
      {canEdit && (
        <div className={cn(
          'flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-lg border text-xs transition-all',
          pendingVs.size > 0
            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
            : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)]',
        )}>
          <span>{pendingVs.size > 0 ? t('war.unsaved_changes', { count: pendingVs.size }) : t('war.no_changes')}</span>
          <div className="flex gap-2">
            <button
              onClick={handleDiscardVs} disabled={pendingVs.size === 0 || isSavingVs}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--color-bg-elevated)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> {t('war.discard_btn')}
            </button>
            <button
              onClick={handleSaveVs} disabled={pendingVs.size === 0 || isSavingVs}
              className="flex items-center gap-1 px-2.5 py-1 rounded font-medium bg-[var(--color-brand)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {isSavingVs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {t('common.save')}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-auto w-full max-h-[calc(100vh-220px)] sm:max-h-[calc(100vh-280px)]">
        <table className="text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)]">
              <th onClick={() => handleSort('inGameName')}
                className="px-3 py-3 text-left text-[var(--color-text-muted)] sticky left-0 z-20 bg-[var(--color-bg-surface)] min-w-[140px] whitespace-nowrap cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors">
                {t('war.col_name')}<SortIcon dir={sortKey === 'inGameName' ? sortDir : null} />
              </th>
              <th onClick={() => handleSort('total')}
                className="px-3 py-3 text-center text-[var(--color-text-muted)] min-w-[64px] whitespace-nowrap cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors">
                {t('vsPoint.col_total')}<SortIcon dir={sortKey === 'total' ? sortDir : null} />
              </th>
              {rounds.map(r => (
                <th key={r.id} onClick={() => handleSort(r.id)}
                  className="px-3 py-3 text-center text-[var(--color-text-muted)] min-w-[64px] group cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors">
                  <div className="text-[10px] font-normal">{r.date?.slice(5) ?? ''}</div>
                  <div className="font-semibold flex items-center justify-center gap-1">
                    {t('war.round', { n: r.sortOrder })}
                    <SortIcon dir={sortKey === r.id ? sortDir : null} />
                    {canEdit && (
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(r.id) }}
                        className="opacity-0 group-hover:opacity-100 text-[var(--color-danger)] hover:text-red-400 transition-opacity">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {vsRows
              .filter(row => !searchQuery || row.inGameName.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(row => (
                <tr key={row.memberId} className="hover:bg-[var(--color-bg-surface)] transition-colors">
                  <td className="px-3 py-2.5 font-medium text-[var(--color-text-primary)] whitespace-nowrap sticky left-0 z-10 bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-surface)]">
                    {row.inGameName}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn('font-bold', row.totalVs > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]')}>
                      {row.totalVs || '·'}
                    </span>
                  </td>
                  {rounds.map(r => {
                    const key = `${row.memberId}::${r.id}`
                    const pending = pendingVs.get(key)
                    const stored = vsPoints.find(v => v.roundId === r.id && v.memberId === row.memberId)
                    const pts = pending !== undefined ? pending : (stored?.points ?? '')
                    const isPending = pending !== undefined
                    const isVsOpen = vsPopover?.roundId === r.id && vsPopover?.memberId === row.memberId
                    return (
                      <td key={r.id}
                        onClick={(e) => openVsPopover(e, r.id, row.memberId)}
                        className={cn(
                          'px-3 py-2.5 text-center select-none transition-colors hover:bg-[var(--color-bg-elevated)]',
                          canEdit && 'cursor-pointer',
                          isVsOpen && 'bg-[var(--color-bg-elevated)]',
                        )}>
                        <span className={cn('relative inline-block', pts ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-muted)]')}>
                          {pts || '·'}
                          {isPending && <span className="absolute -top-1 -right-2 w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ADD ROUND MODAL */}
      {showAddRound && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold">{t('war.add_round_title')}</h2>
              <button onClick={() => setShowAddRound(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
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

      {/* DELETE ROUND MODAL */}
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
                  <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('vsPoint.delete_round_title')}</h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{t('war.round', { n: round?.sortOrder })} · {round?.date}</p>
                </div>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('vsPoint.delete_round_confirm')}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="full" onClick={() => setDeleteConfirmId(null)}>{t('common.cancel')}</Button>
                <Button size="full" className="bg-[var(--color-danger)] hover:bg-red-700 text-white"
                  onClick={async () => { await deleteRound(deleteConfirmId); setDeleteConfirmId(null) }}>
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* VS POPOVER */}
      {vsPopover && (
        <div ref={vsPopoverRef}
          style={{ position: 'fixed', left: vsPopover.x, top: vsPopover.y, transform: 'translateX(-50%)', zIndex: 9999 }}
          className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl p-2 w-36"
          onMouseDown={e => e.stopPropagation()}
        >
          <input type="text" autoFocus
            value={vsPopover.inputValue}
            onChange={e => setVsPopover(prev => prev ? { ...prev, inputValue: e.target.value } : null)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitVsPopover(vsPopover.roundId, vsPopover.memberId, vsPopover.inputValue)
              if (e.key === 'Escape') setVsPopover(null)
            }}
            onBlur={() => commitVsPopover(vsPopover.roundId, vsPopover.memberId, vsPopover.inputValue)}
            placeholder="0"
            className="w-full px-2 py-1.5 text-sm rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand)] text-center"
          />
        </div>
      )}
    </div>
  )
}
