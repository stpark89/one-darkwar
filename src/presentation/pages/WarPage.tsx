import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Plus, X, Loader2, Trash2, Save, RotateCcw, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWarStore } from '@/infrastructure/stores/warStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import type { WarTeam, WarRole } from '@/domain/entities/War'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { SortIcon, nextSortDir } from '@/presentation/components/ui/sort-icon'
import type { SortDir } from '@/presentation/components/ui/sort-icon'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type PendingEntry = { team: WarTeam; role: WarRole; note: string }

type CellPopoverState = {
  roundId: string
  memberId: string
  entry: PendingEntry
  x: number
  y: number
} | null

// ─── EntryCell: 참여(✓) / 미참여(·) 표시 ─────────────────────────────────────

const EntryCell = ({
  role, note, pending,
}: { role: string; note: string; pending: boolean }) => {
  const attended = role !== ''
  return (
    <span className="relative inline-flex items-center justify-center">
      {attended
        ? <span className="text-[var(--color-success)] text-sm font-bold">✓</span>
        : <span className="text-[var(--color-text-muted)]">·</span>
      }
      {note && (
        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-orange-400" title={note} />
      )}
      {pending && !note && (
        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-yellow-400" />
      )}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const WarPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const canEdit = user?.role === 'ROLE_ADMIN'

  const {
    activeSeason, rounds, entries, loading,
    searchQuery, setSearchQuery,
    getMemberRows, getSummary,
    addRound, deleteRound, updateRoundDate, loadData,
    batchSave,
  } = useWarStore()

  // ── Tab & UI state ──
  const [activeTab, setActiveTab] = useState<'grid' | 'ranking'>('grid')
  const [showAddRound, setShowAddRound] = useState(false)
  const [newRoundDate, setNewRoundDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editRoundId, setEditRoundId] = useState<string | null>(null)
  const [editRoundDate, setEditRoundDate] = useState('')
  const [sortKey, setSortKey] = useState<string>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // ── Pending entries (grid tab) ──
  const [pendingEntries, setPendingEntries] = useState<Map<string, PendingEntry>>(new Map())
  const [isSaving, setIsSaving] = useState(false)

  // ── Popovers ──
  const [cellPopover, setCellPopover] = useState<CellPopoverState>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadData() }, [loadData])

  // ── Sorting ──
  const handleSort = (key: string) => {
    if (key !== sortKey) { setSortKey(key); setSortDir('desc'); return }
    const next = nextSortDir(sortDir, true)
    setSortDir(next)
    if (next === null) { setSortKey('total'); setSortDir('desc') }
  }

  // ── Member rows ──
  const baseMemberRows = getMemberRows()
  const summary = getSummary()

  const memberRows = useMemo(() => {
    return [...baseMemberRows].sort((a, b) => {
      if (!sortDir) return 0
      let cmp = 0
      if (sortKey === 'inGameName') cmp = a.inGameName.localeCompare(b.inGameName)
      else if (sortKey === 'total') cmp = a.total - b.total
      else {
        // 회차별 정렬: 참여(1) > 미참여(0)
        const ea = a.entryMap[sortKey] ?? { role: '' }
        const eb = b.entryMap[sortKey] ?? { role: '' }
        cmp = (ea.role !== '' ? 1 : 0) - (eb.role !== '' ? 1 : 0)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [baseMemberRows, sortKey, sortDir])

  // ── Cell popover helpers ──
  const getEffectiveEntry = useCallback((roundId: string, memberId: string): PendingEntry => {
    const key = `${memberId}::${roundId}`
    const pending = pendingEntries.get(key)
    if (pending) return pending
    const stored = entries.find(e => e.roundId === roundId && e.memberId === memberId)
    return { team: stored?.team ?? '', role: stored?.role ?? '', note: stored?.note ?? '' }
  }, [pendingEntries, entries])

  const getOriginalEntry = useCallback((roundId: string, memberId: string): PendingEntry => {
    const stored = entries.find(e => e.roundId === roundId && e.memberId === memberId)
    return { team: stored?.team ?? '', role: stored?.role ?? '', note: stored?.note ?? '' }
  }, [entries])

  const closePopoverWithSave = useCallback(() => {
    if (!cellPopover) return
    const { roundId, memberId, entry } = cellPopover
    const key = `${memberId}::${roundId}`
    const original = getOriginalEntry(roundId, memberId)
    const isDiff =
      entry.role !== original.role ||
      entry.note !== original.note

    setPendingEntries(prev => {
      const next = new Map(prev)
      if (isDiff) next.set(key, entry)
      else next.delete(key)
      return next
    })
    setCellPopover(null)
  }, [cellPopover, getOriginalEntry])

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cellPopover && popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        closePopoverWithSave()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [cellPopover, closePopoverWithSave])

  const openCellPopover = (e: React.MouseEvent, roundId: string, memberId: string) => {
    if (!canEdit) return
    if (cellPopover) closePopoverWithSave()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const entry = getEffectiveEntry(roundId, memberId)
    setCellPopover({ roundId, memberId, entry, x: rect.left + rect.width / 2, y: rect.bottom + 4 })
  }

  // ── Save handlers ──
  const handleSaveEntries = async () => {
    if (pendingEntries.size === 0) return
    setIsSaving(true)
    const changes = Array.from(pendingEntries.entries()).map(([key, entry]) => {
      const [memberId, roundId] = key.split('::')
      return { roundId, memberId, ...entry }
    })
    const ok = await batchSave(changes)
    if (ok) setPendingEntries(new Map())
    setIsSaving(false)
  }

  const handleDiscardEntries = () => { setPendingEntries(new Map()); setCellPopover(null) }

  // ── Round actions ──
  const handleAddRound = async () => {
    await addRound(newRoundDate)
    setShowAddRound(false)
    setNewRoundDate(new Date().toISOString().slice(0, 10))
  }

  const handleEditRoundSave = async () => {
    if (!editRoundId) return
    await updateRoundDate(editRoundId, editRoundDate)
    setEditRoundId(null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (loading && rounds.length === 0) return (
    <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
    </div>
  )

  // Save bar component
  const SaveBar = ({
    count, saving, onSave, onDiscard,
  }: { count: number; saving: boolean; onSave: () => void; onDiscard: () => void }) => (
    <div className={cn(
      'flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-lg border text-xs transition-all',
      count > 0
        ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
        : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)]',
    )}>
      <span>{count > 0 ? t('war.unsaved_changes', { count }) : t('war.no_changes')}</span>
      <div className="flex gap-2">
        <button
          onClick={onDiscard} disabled={count === 0 || saving}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--color-bg-elevated)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> {t('war.discard_btn')}
        </button>
        <button
          onClick={onSave} disabled={count === 0 || saving}
          className="flex items-center gap-1 px-2.5 py-1 rounded font-medium bg-[var(--color-brand)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {t('common.save')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2 sm:gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('war.title')}</h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
            {activeSeason?.name} · {t('war.round_count', { n: rounds.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border-subtle)]">
            {(['grid', 'ranking'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={cn('px-2.5 sm:px-3 py-1.5 rounded text-xs font-medium transition-colors',
                  activeTab === tab ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]')}
              >
                {tab === 'grid' ? t('war.tab_grid') : t('war.tab_ranking')}
              </button>
            ))}
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setShowAddRound(true)}>
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('war.add_round_btn')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Search (grid tab) */}
      {activeTab === 'grid' && (
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('war.search_placeholder')} className="pl-9" />
          </div>
          <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{memberRows.length}{t('common.count_people')}</span>
        </div>
      )}

      {/* Save bar */}
      {canEdit && activeTab === 'grid' && (
        <SaveBar count={pendingEntries.size} saving={isSaving} onSave={handleSaveEntries} onDiscard={handleDiscardEntries} />
      )}

      {/* ── GRID TAB ── */}
      {activeTab === 'grid' && (
        <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-auto w-full max-h-[calc(100vh-260px)] sm:max-h-[calc(100vh-320px)]">
          <table className="text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)]">
                <th onClick={() => handleSort('inGameName')}
                  className="px-3 py-3 text-left text-[var(--color-text-muted)] sticky left-0 bg-[var(--color-bg-surface)] min-w-[140px] whitespace-nowrap cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors">
                  {t('war.col_name')}<SortIcon dir={sortKey === 'inGameName' ? sortDir : null} />
                </th>
                <th onClick={() => handleSort('total')}
                  className="px-3 py-3 text-center text-[var(--color-text-muted)] min-w-[48px] whitespace-nowrap cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors">
                  {t('war.col_total')}<SortIcon dir={sortKey === 'total' ? sortDir : null} />
                </th>
                {rounds.map(r => (
                  <th key={r.id} onClick={() => handleSort(r.id)}
                    className="px-3 py-3 text-center text-[var(--color-text-muted)] min-w-[64px] group cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors">
                    <div className="text-[10px] font-normal flex items-center justify-center gap-1">
                      {r.date?.slice(5) ?? ''}
                      {canEdit && (
                        <button onClick={(e) => { e.stopPropagation(); setEditRoundId(r.id); setEditRoundDate(r.date) }}
                          className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-brand)] transition-opacity">
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
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
              {memberRows.map(row => (
                <tr key={row.memberId} className="hover:bg-[var(--color-bg-surface)] transition-colors">
                  <td className="px-3 py-2.5 font-medium text-[var(--color-text-primary)] whitespace-nowrap sticky left-0 bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-surface)]">
                    {row.inGameName}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-[var(--color-success)] font-bold">{row.total}</span>
                  </td>
                  {rounds.map(r => {
                    const pendingKey = `${row.memberId}::${r.id}`
                    const pending = pendingEntries.get(pendingKey)
                    const baseEntry = row.entryMap[r.id] ?? { team: '', role: '', note: '' }
                    const isPopoverOpen = cellPopover?.roundId === r.id && cellPopover?.memberId === row.memberId
                    const displayEntry = isPopoverOpen ? cellPopover.entry : (pending ?? baseEntry)
                    const isPending = !!pending && !isPopoverOpen
                    return (
                      <td key={r.id}
                        onClick={(e) => openCellPopover(e, r.id, row.memberId)}
                        className={cn(
                          'px-3 py-2.5 text-center select-none transition-colors hover:bg-[var(--color-bg-elevated)]',
                          canEdit && 'cursor-pointer',
                          isPopoverOpen && 'bg-[var(--color-bg-elevated)]',
                        )}>
                        <EntryCell role={displayEntry.role} note={displayEntry.note} pending={isPending} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-[var(--color-bg-surface)] border-t-2 border-[var(--color-border)]">
                <td className="px-3 py-2.5 font-semibold text-[var(--color-text-muted)] text-xs whitespace-nowrap sticky left-0 bg-[var(--color-bg-surface)]">
                  {t('common.total')} / {t('common.count_people')}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="text-xs font-bold text-[var(--color-text-primary)]">
                    {memberRows.filter(row => row.total > 0).length}
                  </span>
                </td>
                {rounds.map(r => {
                  const count = memberRows.filter(row => {
                    const pending = pendingEntries.get(`${row.memberId}::${r.id}`)
                    const e = pending ?? (row.entryMap[r.id] ?? { role: '' })
                    return e.role !== ''
                  }).length
                  return (
                    <td key={r.id} className="px-3 py-2.5 text-center">
                      <span className={cn('text-xs font-bold', count > 0 ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]')}>
                        {count}
                      </span>
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── RANKING TAB ── */}
      {activeTab === 'ranking' && (
        <div className="space-y-2 overflow-auto max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-280px)]">
          {summary.filter(s => s.total > 0).map((s, i) => (
            <div key={s.memberId} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
              <span className={cn('text-lg font-black w-8 text-center',
                i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-[var(--color-text-muted)]')}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
              </span>
              <span className="flex-1 font-medium text-[var(--color-text-primary)] text-sm">{s.inGameName}</span>
              <span className="text-[var(--color-success)] font-bold text-sm">{t('war.ranking_total', { count: s.total })}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── CELL POPOVER ── */}
      {cellPopover && (
        <div ref={popoverRef}
          style={{ position: 'fixed', left: cellPopover.x, top: cellPopover.y, transform: 'translateX(-50%)', zIndex: 9999 }}
          className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl p-2.5 w-52"
          onMouseDown={e => e.stopPropagation()}
        >
          {/* 참여 여부 버튼 */}
          <div className="flex gap-1.5 mb-2">
            <button
              onClick={() => setCellPopover(prev => prev ? { ...prev, entry: { ...prev.entry, team: '' as WarTeam, role: 'CT' as WarRole } } : null)}
              className={cn(
                'flex-1 py-2 rounded-lg text-xs font-bold transition-colors',
                cellPopover.entry.role !== ''
                  ? 'bg-[var(--color-success)] text-white'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-success)]/20 hover:text-[var(--color-success)]',
              )}
            >
              ✓ {t('war.attend_yes')}
            </button>
            <button
              onClick={() => setCellPopover(prev => prev ? { ...prev, entry: { ...prev.entry, team: '' as WarTeam, role: '' as WarRole } } : null)}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-bold transition-colors',
                cellPopover.entry.role === ''
                  ? 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]',
              )}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* 비고 입력 */}
          <input
            type="text"
            value={cellPopover.entry.note}
            onChange={e => setCellPopover(prev => prev ? { ...prev, entry: { ...prev.entry, note: e.target.value } } : null)}
            placeholder={t('war.note_placeholder')}
            className="w-full px-2 py-1.5 text-xs rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand)]"
          />
        </div>
      )}

      {/* ── ADD ROUND MODAL ── */}
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

      {/* ── EDIT ROUND DATE MODAL ── */}
      {editRoundId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold">{t('war.edit_round_title')}</h2>
              <button onClick={() => setEditRoundId(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('war.round_date_label')}</label>
              <Input type="date" value={editRoundDate} onChange={e => setEditRoundDate(e.target.value)} />
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" size="full" onClick={() => setEditRoundId(null)}>{t('common.cancel')}</Button>
              <Button size="full" onClick={handleEditRoundSave}>{t('common.save')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE ROUND MODAL ── */}
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
                  <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{t('war.round', { n: round?.sortOrder })} · {round?.date}</p>
                </div>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('war.delete_round_confirm')}</p>
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
    </div>
  )
}
