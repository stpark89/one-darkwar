import { useEffect, useMemo, useState } from 'react'
import { Loader2, Crown, Swords, Plus, Pencil, Trash2, X, ChevronUp, ChevronDown, Flag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useOccupationStore } from '@/infrastructure/stores/occupationStore'
import type { Facility, OccupationTurn } from '@/domain/entities/Occupation'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { cn } from '@/lib/utils'

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

  useEffect(() => { loadAll(true) }, [loadAll])

  const list = useMemo(
    () => turns.filter((tn) => tn.facility === facility).sort((a, b) => a.sortOrder - b.sortOrder),
    [turns, facility],
  )
  const current = list.find((tn) => tn.isCurrent) ?? null
  const currentIdx = current ? list.findIndex((tn) => tn.id === current.id) : -1
  const next = currentIdx >= 0 && currentIdx < list.length - 1 ? list[currentIdx + 1] : list[0] ?? null

  const openAdd = () => {
    const maxOrder = list.length > 0 ? Math.max(...list.map((tn) => tn.sortOrder)) : 0
    setDraft({ facility, allianceName: '', note: '', id: undefined })
    void maxOrder
  }
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
          isCurrent: list.length === 0, // 첫 항목이면 자동 현재
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
          {/* 현재 차례 배너 */}
          <div className="bg-gradient-to-br from-[var(--color-brand)] to-blue-600 text-white rounded-xl p-4 sm:p-5">
            <p className="text-[11px] uppercase tracking-wider opacity-80 mb-1 flex items-center gap-1">
              <Flag className="w-3 h-3" /> {t('occupation.current_turn')}
            </p>
            {current ? (
              <p className="text-2xl sm:text-3xl font-black">{current.allianceName}</p>
            ) : (
              <p className="text-lg font-bold opacity-70">{t('occupation.no_current')}</p>
            )}
            {current?.note && <p className="text-xs opacity-90 mt-1">{current.note}</p>}
            {next && next.id !== current?.id && (
              <p className="text-xs opacity-80 mt-2">
                {t('occupation.next_turn')}: <span className="font-bold">{next.allianceName}</span>
              </p>
            )}
          </div>

          {/* 순번 테이블 — 주차별 2D (8슬롯/주차) */}
          {list.length > 0 && (() => {
            const SLOTS = 8
            // sort_order 기준으로 8개씩 주차 분리
            const weeks: typeof list[] = []
            for (let i = 0; i < list.length; i += SLOTS) {
              weeks.push(list.slice(i, i + SLOTS))
            }
            // 현재 차례가 속한 주차 인덱스
            const currentWeekIdx = weeks.findIndex((w) => w.some((tn) => tn.isCurrent))
            const facilityLabel = facility === 'armory' ? t('occupation.armory') : t('occupation.castle')

            return (
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="border-collapse text-xs w-full">
                    {/* 헤더: 슬롯 번호 1~8 */}
                    <thead>
                      <tr className="bg-[var(--color-bg-elevated)]">
                        <td className="px-3 py-2 font-bold text-[var(--color-text-muted)] border-r border-b border-[var(--color-border-subtle)] whitespace-nowrap sticky left-0 bg-[var(--color-bg-elevated)] z-10">
                          {facilityLabel}
                        </td>
                        {Array.from({ length: SLOTS }, (_, i) => (
                          <th key={i} className="px-3 py-2 font-bold text-center text-[var(--color-text-muted)] border-r border-b border-[var(--color-border-subtle)] last:border-r-0 min-w-[56px]">
                            {i + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    {/* 본문: 주차별 행 */}
                    <tbody>
                      {weeks.map((week, wi) => {
                        const isCurrentWeek = wi === currentWeekIdx
                        return (
                          <tr key={wi} className={cn(isCurrentWeek && 'bg-[var(--color-brand)]/5')}>
                            {/* 주차 라벨 */}
                            <td className={cn(
                              'px-3 py-2.5 font-bold whitespace-nowrap border-r border-b border-[var(--color-border-subtle)] sticky left-0 z-10',
                              isCurrentWeek
                                ? 'text-[var(--color-brand)] bg-[var(--color-brand)]/10'
                                : 'text-[var(--color-text-muted)] bg-[var(--color-bg-surface)]',
                            )}>
                              {wi + 1}{t('occupation.week_suffix')}
                            </td>
                            {/* 슬롯 셀 */}
                            {Array.from({ length: SLOTS }, (_, si) => {
                              const tn = week[si]
                              return (
                                <td
                                  key={si}
                                  className={cn(
                                    'px-2 py-2.5 text-center border-r border-b border-[var(--color-border-subtle)] last:border-r-0 whitespace-nowrap',
                                    tn?.isCurrent
                                      ? 'bg-[var(--color-brand)]/20 text-[var(--color-brand)] font-black'
                                      : tn
                                        ? 'text-[var(--color-text-primary)] font-semibold'
                                        : 'text-[var(--color-text-muted)]',
                                  )}
                                >
                                  {tn ? (
                                    <>
                                      {tn.allianceName}
                                      {tn.isCurrent && (
                                        <span className="block text-[9px] font-normal text-[var(--color-brand)] mt-0.5">
                                          ▶ {t('occupation.current_badge')}
                                        </span>
                                      )}
                                    </>
                                  ) : '—'}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* 순번 리스트 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">{t('occupation.rotation')}</h2>
              {isAdmin && (
                <Button size="sm" onClick={openAdd}>
                  <Plus className="w-4 h-4" /> {t('occupation.add_btn')}
                </Button>
              )}
            </div>

            {list.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-8">{t('occupation.empty')}</p>
            ) : (
              <div className="space-y-1.5">
                {list.map((tn, i) => (
                  <div
                    key={tn.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
                      tn.isCurrent
                        ? 'bg-[var(--color-brand)]/10 border-[var(--color-brand)]/40'
                        : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)]',
                    )}
                  >
                    <span className="text-xs font-mono text-[var(--color-text-muted)] w-5 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{tn.allianceName}</span>
                        {tn.isCurrent && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)] text-white">{t('occupation.current_badge')}</span>
                        )}
                      </div>
                      {tn.note && <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{tn.note}</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {/* 순서 이동 */}
                        <button onClick={() => move(tn.id, 'up')} disabled={i === 0} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30">
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => move(tn.id, 'down')} disabled={i === list.length - 1} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30">
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        {/* 현재 지정 */}
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
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* 추가/수정 모달 */}
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

      {/* 삭제 확인 */}
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
