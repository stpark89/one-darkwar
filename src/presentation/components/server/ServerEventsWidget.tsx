import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CalendarClock, CalendarDays, Crown, Swords, Plus, Pencil, Trash2, X, Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useServerEventStore } from '@/infrastructure/stores/serverEventStore'
import type { EventCategory, ServerEvent } from '@/domain/entities/ServerEvent'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { cn } from '@/lib/utils'

const pad = (n: number) => String(n).padStart(2, '0')
const isoToLocalInput = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const CAT_META: Record<EventCategory, { icon: typeof Crown; key: string }> = {
  siege: { icon: Crown, key: 'server_home.cat_siege' },
  armory: { icon: Swords, key: 'server_home.cat_armory' },
  event: { icon: CalendarDays, key: 'server_home.cat_event' },
  other: { icon: CalendarClock, key: 'server_home.cat_other' },
}

interface Draft {
  id?: string
  title: string
  eventAt: string // datetime-local 값 (로컬)
  category: EventCategory
  note: string
}

export const ServerEventsWidget = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ROLE_ADMIN'
  const { events, loadAll, add, update, remove } = useServerEventStore()

  const [now, setNow] = useState(() => Date.now())
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const sorted = useMemo(
    () => [...events].sort((a, b) => a.eventAt.localeCompare(b.eventAt)),
    [events],
  )
  const upcoming = useMemo(
    () => sorted.filter((e) => new Date(e.eventAt).getTime() >= now),
    [sorted, now],
  )
  const next = upcoming[0] ?? null
  // 비관리자는 예정 일정만(최대 5), 관리자는 전체(지난 일정 포함)
  const visible = (isAdmin ? sorted : upcoming).slice(0, isAdmin ? 50 : 5)

  if (events.length === 0 && !isAdmin) return null

  const countdown = (() => {
    if (!next) return null
    const diff = new Date(next.eventAt).getTime() - now
    if (diff <= 0) return null
    const total = Math.floor(diff / 1000)
    const d = Math.floor(total / 86400)
    const h = Math.floor((total % 86400) / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    return { d, label: `${pad(h)}:${pad(m)}:${pad(s)}` }
  })()

  const openAdd = () => {
    const soon = new Date(now + 60 * 60 * 1000)
    setDraft({ title: '', eventAt: isoToLocalInput(soon.toISOString()), category: 'event', note: '' })
  }
  const openEdit = (e: ServerEvent) =>
    setDraft({ id: e.id, title: e.title, eventAt: isoToLocalInput(e.eventAt), category: e.category, note: e.note })

  const handleSave = async () => {
    if (!draft || saving || !draft.title.trim() || !draft.eventAt) return
    setSaving(true)
    try {
      const iso = new Date(draft.eventAt).toISOString()
      if (draft.id) {
        await update(draft.id, { title: draft.title, eventAt: iso, category: draft.category, note: draft.note })
      } else {
        await add({ title: draft.title, eventAt: iso, category: draft.category, note: draft.note })
      }
      setDraft(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4 text-[var(--color-brand)]" /> {t('server_home.events')}
        </h2>
        {isAdmin && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4" /> {t('server_home.event_add')}
          </Button>
        )}
      </div>

      {/* 다음 일정 카운트다운 배너 */}
      {next && countdown && (
        <div className="bg-gradient-to-br from-[var(--color-brand)] to-blue-600 text-white rounded-xl p-4 mb-2">
          <p className="text-[11px] uppercase tracking-wider opacity-80 mb-0.5">{t('server_home.next_event')}</p>
          <p className="text-base font-bold leading-snug">{next.title}</p>
          <div className="flex items-end justify-between mt-1.5">
            <span className="text-xs opacity-90">{fmtDate(next.eventAt)}</span>
            <span className="font-black tabular-nums flex items-baseline gap-1">
              {countdown.d > 0 && <span className="text-sm">D-{countdown.d}</span>}
              <span className="text-lg">{countdown.label}</span>
            </span>
          </div>
        </div>
      )}

      {/* 일정 목록 */}
      {visible.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-6 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl">
          {t('server_home.no_events')}
        </p>
      ) : (
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl divide-y divide-[var(--color-border-subtle)] overflow-hidden">
          {visible.map((e) => {
            const past = new Date(e.eventAt).getTime() < now
            const { icon: Icon, key } = CAT_META[e.category]
            return (
              <div key={e.id} className={cn('flex items-center gap-3 px-4 py-2.5', past && 'opacity-45')}>
                <div className="w-8 h-8 rounded-lg bg-[var(--color-brand)]/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[var(--color-brand)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{e.title}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {fmtDate(e.eventAt)} · {t(key)}{e.note ? ` · ${e.note}` : ''}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => openEdit(e)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-brand)]">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(e.id)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 추가/수정 모달 */}
      {draft && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                {draft.id ? t('server_home.event_edit_title') : t('server_home.event_add_title')}
              </h2>
              <button onClick={() => setDraft(null)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('server_home.event_field_title')} *</label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('server_home.event_field_when')} *</label>
              <Input type="datetime-local" value={draft.eventAt} onChange={(e) => setDraft({ ...draft, eventAt: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('server_home.event_field_category')}</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(CAT_META) as EventCategory[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, category: c })}
                    className={cn(
                      'py-2 rounded-lg text-xs font-semibold border transition-colors',
                      draft.category === c
                        ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                        : 'border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                    )}
                  >
                    {t(CAT_META[c].key)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('server_home.event_field_note')}</label>
              <Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="full" onClick={() => setDraft(null)}>{t('common.cancel')}</Button>
              <Button size="full" disabled={!draft.title.trim() || !draft.eventAt || saving} onClick={handleSave}>
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
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-2">{t('server_home.event_delete_title')}</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('server_home.event_delete_desc')}</p>
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
