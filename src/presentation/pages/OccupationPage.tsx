import { useEffect, useMemo, useState, useRef } from 'react'
import { Loader2, Crown, Swords, X, CalendarPlus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useOccupationStore } from '@/infrastructure/stores/occupationStore'
import type { Facility, OccupationTurn } from '@/domain/entities/Occupation'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { cn } from '@/lib/utils'

const SLOTS = 8

// 무기고 8슬롯 아이템 이름
const ARMORY_SLOT_KEYS = [
  'armory_slot_1', 'armory_slot_2', 'armory_slot_3', 'armory_slot_4',
  'armory_slot_5', 'armory_slot_6', 'armory_slot_7', 'armory_slot_8',
] as const

// 인라인 편집 상태 — existingId 있으면 수정, 없으면 신규 추가
interface InlineEdit {
  wi: number
  si: number
  value: string
  existingId?: string   // 기존 항목 수정 시
}

export const OccupationPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ROLE_ADMIN'
  const { turns, loading, loadAll, add, update, remove } = useOccupationStore()

  const [facility, setFacility] = useState<Facility>('armory')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // 인라인 편집
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null)
  const [inlineSaving, setInlineSaving] = useState(false)
  const inlineInputRef = useRef<HTMLInputElement>(null)

  // 주차 추가 다이얼로그
  const [addWeekOpen, setAddWeekOpen] = useState(false)
  const [weekDraft, setWeekDraft] = useState<string[]>(Array(SLOTS).fill(''))

  useEffect(() => { loadAll(true) }, [loadAll])

  const list = useMemo(
    () => turns.filter((tn) => tn.facility === facility).sort((a, b) => a.sortOrder - b.sortOrder),
    [turns, facility],
  )

  const weeks = useMemo(() => {
    const result: OccupationTurn[][] = []
    for (let i = 0; i < list.length; i += SLOTS) result.push(list.slice(i, i + SLOTS))
    return result
  }, [list])

  const currentWeekIdx = useMemo(
    () => weeks.findIndex((w) => w.some((tn) => tn.isCurrent)),
    [weeks],
  )

  // ── 인라인 편집 ──────────────────────────────────────────────
  const openInlineEdit = (wi: number, si: number, existing?: OccupationTurn) => {
    if (!isAdmin) return
    setInlineEdit({ wi, si, value: existing?.allianceName ?? '', existingId: existing?.id })
    setTimeout(() => inlineInputRef.current?.focus(), 0)
  }

  const handleInlineSave = async () => {
    if (!inlineEdit || !inlineEdit.value.trim() || inlineSaving) return
    setInlineSaving(true)
    try {
      if (inlineEdit.existingId) {
        await update(inlineEdit.existingId, { allianceName: inlineEdit.value.trim(), note: '' })
      } else {
        const targetOrder = inlineEdit.wi * SLOTS + inlineEdit.si + 1
        await add({
          facility,
          allianceName: inlineEdit.value.trim(),
          note: '',
          sortOrder: targetOrder,
          isCurrent: list.length === 0,
        })
      }
      setInlineEdit(null)
    } finally {
      setInlineSaving(false)
    }
  }

  const handleInlineDelete = async () => {
    if (!inlineEdit?.existingId || inlineSaving) return
    setInlineSaving(true)
    try {
      await remove(inlineEdit.existingId)
      setInlineEdit(null)
    } finally {
      setInlineSaving(false)
    }
  }

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); void handleInlineSave() }
    if (e.key === 'Escape') setInlineEdit(null)
  }

  // ── 주차 추가 ─────────────────────────────────────────────────
  const openAddWeek = () => {
    const lastWeek = weeks[weeks.length - 1] ?? []
    const names = lastWeek.map((tn) => tn.allianceName)
    const rotated = names.length > 0 ? [...names.slice(1), names[0]] : Array(SLOTS).fill('')
    setWeekDraft([...rotated, ...Array(SLOTS).fill('')].slice(0, SLOTS))
    setAddWeekOpen(true)
  }

  const handleAddWeek = async () => {
    if (!weekDraft.some((n) => n.trim()) || saving) return
    setSaving(true)
    try {
      const maxOrder = list.length > 0 ? Math.max(...list.map((tn) => tn.sortOrder)) : 0
      for (let i = 0; i < weekDraft.length; i++) {
        const name = weekDraft[i].trim()
        if (!name) continue
        await add({ facility, allianceName: name, note: '', sortOrder: maxOrder + i + 1, isCurrent: false })
      }
      setAddWeekOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const FACILITIES: { key: Facility; label: string; icon: typeof Crown }[] = [
    { key: 'armory', label: t('occupation.armory'), icon: Swords },
    { key: 'castle', label: t('occupation.castle'), icon: Crown },
  ]

  const facilityLabel = facility === 'armory' ? t('occupation.armory') : t('occupation.castle')
  const LABEL_W = 64
  const CELL_W  = 88

  const slotHeaders: string[] = facility === 'armory'
    ? ARMORY_SLOT_KEYS.map((k) => t(`occupation.${k}`))
    : Array.from({ length: SLOTS }, (_, i) => String(i + 1))

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto space-y-5 break-keep">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('occupation.title')}</h1>
        <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">{t('occupation.subtitle')}</p>
      </div>

      {/* 시설 탭 */}
      <div className="flex gap-1 p-1 bg-[var(--color-bg-elevated)] rounded-lg w-fit">
        {FACILITIES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFacility(key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold transition-colors',
              facility === key
                ? 'bg-[var(--color-brand)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {loading && turns.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : (
        <div className="space-y-3">
          {/* 관리자 툴바 */}
          {isAdmin && (
            <div className="flex items-center justify-end">
              <Button size="sm" variant="outline" onClick={openAddWeek}>
                <CalendarPlus className="w-4 h-4" />
                {t('occupation.add_week_btn')}
              </Button>
            </div>
          )}

          {/* ── 순번 그리드 ── */}
          {list.length === 0 ? (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl py-16 flex flex-col items-center gap-3 text-[var(--color-text-muted)]">
              <Swords className="w-10 h-10 opacity-25" />
              <p className="text-sm">{t('occupation.empty')}</p>
              {isAdmin && (
                <Button size="sm" onClick={openAddWeek}>
                  <CalendarPlus className="w-4 h-4" />
                  {t('occupation.add_week_btn')}
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table
                  className="text-xs border-separate border-spacing-0"
                  style={{ minWidth: LABEL_W + CELL_W * SLOTS }}
                >
                  {/* 헤더 */}
                  <thead>
                    <tr>
                      <th
                        className="border-r border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] sticky left-0 z-20 text-left px-3 py-3 font-bold text-[var(--color-text-muted)] text-[11px]"
                        style={{ width: LABEL_W, minWidth: LABEL_W }}
                      >
                        {facilityLabel}
                      </th>
                      {slotHeaders.map((label, i) => (
                        <th
                          key={i}
                          className="border-r border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-center px-2 py-3 font-bold text-[var(--color-text-muted)] last:border-r-0 leading-tight text-[11px]"
                          style={{ width: CELL_W, minWidth: CELL_W }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  {/* 본문 */}
                  <tbody>
                    {weeks.map((week, wi) => {
                      const isCurrentWeek = wi === currentWeekIdx
                      return (
                        <tr key={wi}>
                          {/* 주차 라벨 */}
                          <td
                            className={cn(
                              'border-r border-b border-[var(--color-border-subtle)] sticky left-0 z-10 px-3 py-3 font-bold whitespace-nowrap text-[11px]',
                              isCurrentWeek
                                ? 'text-[var(--color-brand)] bg-[var(--color-brand)]/10'
                                : 'text-[var(--color-text-muted)] bg-[var(--color-bg-surface)]',
                            )}
                            style={{ width: LABEL_W, minWidth: LABEL_W }}
                          >
                            {wi + 1}{t('occupation.week_suffix')}
                          </td>

                          {/* 슬롯 셀 */}
                          {Array.from({ length: SLOTS }, (_, si) => {
                            const tn = week[si]
                            const isEditingThis = inlineEdit?.wi === wi && inlineEdit?.si === si

                            if (isEditingThis) {
                              return (
                                <td
                                  key={si}
                                  className="border-r border-b border-[var(--color-border-subtle)] last:border-r-0 p-0 relative"
                                  style={{ width: CELL_W, minWidth: CELL_W }}
                                >
                                  <div className="flex items-center">
                                    <input
                                      ref={inlineInputRef}
                                      type="text"
                                      value={inlineEdit.value}
                                      onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                      onKeyDown={handleInlineKeyDown}
                                      onBlur={() => {
                                        if (inlineEdit.value.trim()) void handleInlineSave()
                                        else setInlineEdit(null)
                                      }}
                                      disabled={inlineSaving}
                                      placeholder="동맹명"
                                      className="flex-1 min-w-0 px-2 py-3 text-center text-xs bg-[var(--color-brand)]/5 border-2 border-[var(--color-brand)] outline-none placeholder:text-[var(--color-text-muted)]/40 text-[var(--color-text-primary)] h-full"
                                    />
                                    {/* 기존 항목이면 삭제 버튼 */}
                                    {inlineEdit.existingId && !inlineSaving && (
                                      <button
                                        onMouseDown={(e) => { e.preventDefault(); void handleInlineDelete() }}
                                        className="px-1.5 h-full flex items-center text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 border-l border-[var(--color-border-subtle)] flex-shrink-0"
                                        title={t('common.delete')}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                    {inlineSaving && (
                                      <Loader2 className="w-3 h-3 animate-spin absolute right-1.5 text-[var(--color-brand)]" />
                                    )}
                                  </div>
                                </td>
                              )
                            }

                            return (
                              <td
                                key={si}
                                onClick={() => openInlineEdit(wi, si, tn)}
                                className={cn(
                                  'border-r border-b border-[var(--color-border-subtle)] last:border-r-0 text-center px-2 py-3 whitespace-nowrap transition-colors text-xs',
                                  tn?.isCurrent
                                    ? 'bg-[var(--color-brand)]/20 text-[var(--color-brand)] font-black'
                                    : tn
                                      ? isAdmin
                                        ? 'text-[var(--color-text-primary)] font-semibold cursor-pointer hover:bg-[var(--color-brand)]/10'
                                        : 'text-[var(--color-text-primary)] font-semibold'
                                      : isAdmin
                                        ? 'text-[var(--color-text-muted)]/30 cursor-pointer hover:bg-[var(--color-brand)]/10 hover:text-[var(--color-brand)] select-none'
                                        : 'text-[var(--color-text-muted)]/30',
                                )}
                              >
                                {tn ? tn.allianceName : (isAdmin ? '—' : '')}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* 관리자 힌트 */}
              {isAdmin && (
                <p className="text-[10px] text-[var(--color-text-muted)]/50 px-4 py-2.5 border-t border-[var(--color-border-subtle)]">
                  {t('occupation.inline_hint')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 주차 추가 모달 ────────────────────────────────────── */}
      {addWeekOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('occupation.add_week_title')}</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t('occupation.add_week_desc')}</p>
              </div>
              <button onClick={() => setAddWeekOpen(false)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {Array.from({ length: SLOTS }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[var(--color-text-muted)] w-6 text-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <Input
                    value={weekDraft[i]}
                    onChange={(e) => {
                      const next = [...weekDraft]; next[i] = e.target.value; setWeekDraft(next)
                    }}
                    placeholder={`슬롯 ${i + 1} 동맹명`}
                    autoFocus={i === 0}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="full" onClick={() => setAddWeekOpen(false)}>{t('common.cancel')}</Button>
              <Button size="full" disabled={!weekDraft.some((n) => n.trim()) || saving} onClick={handleAddWeek}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 (그리드 외부 삭제 경로용) ─────────────── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />
              </div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('occupation.delete_title')}</h2>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('occupation.delete_desc')}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="full" onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button>
              <Button size="full" className="bg-[var(--color-danger)] hover:bg-red-700 text-white"
                onClick={async () => { await remove(deleteId); setDeleteId(null) }}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 현재 차례 지정 모달 없음 — 셀 클릭 인라인 편집으로 통합 */}
    </div>
  )
}
