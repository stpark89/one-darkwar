import { useEffect, useMemo, useState, useRef } from 'react'
import { Loader2, Crown, Swords, Plus, Pencil, Trash2, X, ChevronUp, ChevronDown, Flag, CalendarPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useOccupationStore } from '@/infrastructure/stores/occupationStore'
import type { Facility, OccupationTurn } from '@/domain/entities/Occupation'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { cn } from '@/lib/utils'

const SLOTS = 8

interface EditDraft {
  id?: string
  facility: Facility
  allianceName: string
  note: string
}

export const OccupationPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ROLE_ADMIN'
  const { turns, loading, loadAll, add, update, remove, setCurrent, move } = useOccupationStore()

  const [facility, setFacility] = useState<Facility>('armory')
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // 빈 슬롯 인라인 입력
  const [inlineEdit, setInlineEdit] = useState<{ wi: number; si: number; value: string } | null>(null)
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

  // 8개씩 주차로 분리
  const weeks = useMemo(() => {
    const result: OccupationTurn[][] = []
    for (let i = 0; i < list.length; i += SLOTS) {
      result.push(list.slice(i, i + SLOTS))
    }
    return result
  }, [list])

  // 현재 차례 주차 인덱스
  const currentWeekIdx = useMemo(
    () => weeks.findIndex((w) => w.some((tn) => tn.isCurrent)),
    [weeks],
  )

  // ── 인라인 편집 ──────────────────────────────────────────────
  const handleInlineCellClick = (wi: number, si: number) => {
    if (!isAdmin) return
    setInlineEdit({ wi, si, value: '' })
    // 다음 렌더 후 포커스
    setTimeout(() => inlineInputRef.current?.focus(), 0)
  }

  const handleInlineSave = async () => {
    if (!inlineEdit || !inlineEdit.value.trim() || inlineSaving) return
    setInlineSaving(true)
    try {
      // 위치 기반 sort_order (빈 슬롯의 정확한 위치)
      const targetOrder = inlineEdit.wi * SLOTS + inlineEdit.si + 1
      await add({
        facility,
        allianceName: inlineEdit.value.trim(),
        note: '',
        sortOrder: targetOrder,
        isCurrent: list.length === 0,
      })
      setInlineEdit(null)
    } finally {
      setInlineSaving(false)
    }
  }

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleInlineSave()
    }
    if (e.key === 'Escape') {
      setInlineEdit(null)
    }
  }

  // ── 주차 추가 ─────────────────────────────────────────────────
  const openAddWeek = () => {
    const lastWeek = weeks[weeks.length - 1] ?? []
    const names = lastWeek.map((tn) => tn.allianceName)
    // 이전 주차 순서를 1칸 앞으로 rotate 해서 제안
    const rotated = names.length > 0
      ? [...names.slice(1), names[0]]
      : Array(SLOTS).fill('')
    const filled: string[] = [...rotated, ...Array(SLOTS).fill('')].slice(0, SLOTS)
    setWeekDraft(filled)
    setAddWeekOpen(true)
  }

  const handleAddWeek = async () => {
    const hasAny = weekDraft.some((n) => n.trim())
    if (!hasAny || saving) return
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

  // ── 단건 추가/수정 ────────────────────────────────────────────
  const openAdd = () => setDraft({ facility, allianceName: '', note: '', id: undefined })
  const openEdit = (tn: OccupationTurn) => setDraft({ id: tn.id, facility: tn.facility, allianceName: tn.allianceName, note: tn.note })

  const handleSave = async () => {
    if (!draft || saving) return
    setSaving(true)
    try {
      if (draft.id) {
        await update(draft.id, { allianceName: draft.allianceName, note: draft.note })
      } else {
        const maxOrder = list.length > 0 ? Math.max(...list.map((tn) => tn.sortOrder)) : 0
        await add({
          facility: draft.facility,
          allianceName: draft.allianceName,
          note: draft.note,
          sortOrder: maxOrder + 1,
          isCurrent: list.length === 0,
        })
      }
      setDraft(null)
    } finally {
      setSaving(false)
    }
  }

  const FACILITIES: { key: Facility; label: string; icon: typeof Crown }[] = [
    { key: 'armory', label: t('occupation.armory'), icon: Swords },
    { key: 'castle', label: t('occupation.castle'), icon: Crown },
  ]

  const facilityLabel = facility === 'armory' ? t('occupation.armory') : t('occupation.castle')
  const LABEL_W = 56
  const CELL_W  = 64

  return (
    <div className="p-3 sm:p-6 max-w-2xl mx-auto space-y-4 break-keep">
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
        <div className="flex items-center justify-center h-32 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : (
        <>
          {/* ── 순번 테이블 섹션 ──────────────────────────────── */}
          <div className="space-y-2">
            {/* 관리자 헤더 (주차 추가 버튼) */}
            {isAdmin && (
              <div className="flex items-center justify-end">
                <Button size="sm" variant="outline" onClick={openAddWeek}>
                  <CalendarPlus className="w-4 h-4" />
                  {t('occupation.add_week_btn')}
                </Button>
              </div>
            )}

            {list.length === 0 ? (
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl py-12 flex flex-col items-center gap-3 text-[var(--color-text-muted)]">
                <Swords className="w-8 h-8 opacity-30" />
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
                  {/* border-separate + border-spacing-0 → sticky 와 border 충돌 방지 */}
                  <table className="text-xs border-separate border-spacing-0" style={{ minWidth: LABEL_W + CELL_W * SLOTS }}>
                    <thead>
                      <tr>
                        <th
                          className="border-r border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] sticky left-0 z-20 text-left px-3 py-2 font-bold text-[var(--color-text-muted)]"
                          style={{ width: LABEL_W, minWidth: LABEL_W }}
                        >
                          {facilityLabel}
                        </th>
                        {Array.from({ length: SLOTS }, (_, i) => (
                          <th
                            key={i}
                            className="border-r border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-center px-2 py-2 font-bold text-[var(--color-text-muted)] last:border-r-0"
                            style={{ width: CELL_W, minWidth: CELL_W }}
                          >
                            {i + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weeks.map((week, wi) => {
                        const isCurrentWeek = wi === currentWeekIdx
                        return (
                          <tr key={wi}>
                            {/* 주차 라벨 — sticky */}
                            <td
                              className={cn(
                                'border-r border-b border-[var(--color-border-subtle)] sticky left-0 z-10 px-3 py-2.5 font-bold whitespace-nowrap',
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
                              const isEditingThis =
                                inlineEdit?.wi === wi && inlineEdit?.si === si

                              if (isEditingThis) {
                                // 인라인 입력 중인 셀
                                return (
                                  <td
                                    key={si}
                                    className="border-r border-b border-[var(--color-border-subtle)] last:border-r-0 p-0"
                                    style={{ width: CELL_W, minWidth: CELL_W }}
                                  >
                                    <div className="relative flex items-center">
                                      <input
                                        ref={inlineInputRef}
                                        type="text"
                                        value={inlineEdit.value}
                                        onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                        onKeyDown={handleInlineKeyDown}
                                        onBlur={() => {
                                          // blur 시 값 있으면 저장, 없으면 닫기
                                          if (inlineEdit.value.trim()) {
                                            void handleInlineSave()
                                          } else {
                                            setInlineEdit(null)
                                          }
                                        }}
                                        disabled={inlineSaving}
                                        placeholder="동맹명"
                                        className="w-full h-full px-1.5 py-2 text-center text-xs bg-[var(--color-brand)]/5 border-2 border-[var(--color-brand)] outline-none placeholder:text-[var(--color-text-muted)]/40 text-[var(--color-text-primary)]"
                                        style={{ width: CELL_W, minWidth: CELL_W }}
                                      />
                                      {inlineSaving && (
                                        <Loader2 className="w-3 h-3 animate-spin absolute right-1 text-[var(--color-brand)]" />
                                      )}
                                    </div>
                                  </td>
                                )
                              }

                              return (
                                <td
                                  key={si}
                                  onClick={() => !tn && handleInlineCellClick(wi, si)}
                                  className={cn(
                                    'border-r border-b border-[var(--color-border-subtle)] last:border-r-0 text-center px-2 py-2.5 whitespace-nowrap transition-colors',
                                    tn?.isCurrent
                                      ? 'bg-[var(--color-brand)]/20 text-[var(--color-brand)] font-black'
                                      : tn
                                        ? 'text-[var(--color-text-primary)] font-semibold'
                                        : isAdmin
                                          ? 'text-[var(--color-text-muted)]/40 cursor-pointer hover:bg-[var(--color-brand)]/10 hover:text-[var(--color-brand)] select-none'
                                          : 'text-[var(--color-text-muted)]/40',
                                  )}
                                >
                                  {tn ? tn.allianceName : '—'}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {/* 힌트 (관리자) */}
                {isAdmin && (
                  <p className="text-[10px] text-[var(--color-text-muted)]/60 px-3 py-2 border-t border-[var(--color-border-subtle)]">
                    {t('occupation.inline_hint')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── 순번 관리 리스트 — 관리자 전용 ─────────────────── */}
          {isAdmin && list.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-[var(--color-brand)]" />
                  {t('occupation.rotation')}
                </h2>
                <Button size="sm" onClick={openAdd}>
                  <Plus className="w-4 h-4" /> {t('occupation.add_btn')}
                </Button>
              </div>

              <div className="space-y-1">
                {list.map((tn, i) => {
                  const weekIdx = Math.floor(i / SLOTS)
                  const slotIdx = i % SLOTS
                  const isWeekStart = slotIdx === 0
                  return (
                    <div key={tn.id}>
                      {/* 주차 구분선 */}
                      {isWeekStart && (
                        <div className="flex items-center gap-2 mt-2 mb-1 first:mt-0">
                          <span className="text-[10px] font-bold text-[var(--color-brand)] bg-[var(--color-brand)]/10 px-2 py-0.5 rounded">
                            {weekIdx + 1}{t('occupation.week_suffix')}
                          </span>
                          <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
                        </div>
                      )}
                      <div
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors',
                          tn.isCurrent
                            ? 'bg-[var(--color-brand)]/10 border-[var(--color-brand)]/40'
                            : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)]',
                        )}
                      >
                        {/* 슬롯 번호 */}
                        <span className="text-[10px] font-mono font-bold text-[var(--color-text-muted)] w-4 flex-shrink-0 text-center">
                          {slotIdx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{tn.allianceName}</span>
                            {tn.isCurrent && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)] text-white">
                                {t('occupation.current_badge')}
                              </span>
                            )}
                          </div>
                          {tn.note && <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{tn.note}</p>}
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={() => move(tn.id, 'up')} disabled={i === 0} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30">
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => move(tn.id, 'down')} disabled={i === list.length - 1} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          {!tn.isCurrent && (
                            <button onClick={() => setCurrent(facility, tn.id)} title={t('occupation.set_current')} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-brand)]">
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => openEdit(tn)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-brand)]">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteId(tn.id)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 비관리자 빈 상태 */}
          {!isAdmin && list.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">{t('occupation.empty')}</p>
          )}
        </>
      )}

      {/* ── 단건 추가/수정 모달 ───────────────────────────────── */}
      {draft && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                {draft.id ? t('occupation.edit_title') : t('occupation.add_title')}
              </h2>
              <button onClick={() => setDraft(null)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('occupation.field_alliance')} *</label>
              <Input value={draft.allianceName} onChange={(e) => setDraft({ ...draft, allianceName: e.target.value })} placeholder="ONE / NXO / NH-D" autoFocus />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('occupation.field_note')}</label>
              <Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder={t('occupation.note_placeholder')} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="full" onClick={() => setDraft(null)}>{t('common.cancel')}</Button>
              <Button size="full" disabled={!draft.allianceName.trim() || saving} onClick={handleSave}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
              </Button>
            </div>
          </div>
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
                      const next = [...weekDraft]
                      next[i] = e.target.value
                      setWeekDraft(next)
                    }}
                    placeholder={`슬롯 ${i + 1} 동맹명`}
                    autoFocus={i === 0}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="full" onClick={() => setAddWeekOpen(false)}>{t('common.cancel')}</Button>
              <Button
                size="full"
                disabled={!weekDraft.some((n) => n.trim()) || saving}
                onClick={handleAddWeek}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 ─────────────────────────────────────────── */}
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
    </div>
  )
}
