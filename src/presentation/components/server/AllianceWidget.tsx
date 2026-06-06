import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield, Plus, Pencil, Trash2, X, Loader2, Check } from 'lucide-react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useAllianceStore } from '@/infrastructure/stores/allianceStore'
import type { Alliance } from '@/domain/entities/Alliance'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { cn } from '@/lib/utils'

interface Draft {
  id?: string
  name: string
  tag: string
  recruiting: boolean
  contact: string
  note: string
  isHome: boolean
  sortOrder: number
}

const emptyDraft: Draft = { name: '', tag: '', recruiting: false, contact: '', note: '', isHome: false, sortOrder: 0 }

export const AllianceWidget = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ROLE_ADMIN'
  const { alliances, loadAll, add, update, remove } = useAllianceStore()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [loadAll])

  if (alliances.length === 0 && !isAdmin) return null

  const openEdit = (a: Alliance) =>
    setDraft({ id: a.id, name: a.name, tag: a.tag, recruiting: a.recruiting, contact: a.contact, note: a.note, isHome: a.isHome, sortOrder: a.sortOrder })

  const handleSave = async () => {
    if (!draft || saving || !draft.name.trim()) return
    setSaving(true)
    try {
      if (draft.id) {
        await update(draft.id, draft)
      } else {
        await add(draft)
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
          <Shield className="w-4 h-4 text-[var(--color-brand)]" /> {t('server_home.alliances')}
        </h2>
        {isAdmin && (
          <Button size="sm" onClick={() => setDraft({ ...emptyDraft })}>
            <Plus className="w-4 h-4" /> {t('server_home.event_add')}
          </Button>
        )}
      </div>

      {alliances.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-6 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl">
          {t('server_home.no_alliances')}
        </p>
      ) : (
        <div className="space-y-2">
          {alliances.map((a) => (
            <div
              key={a.id}
              className={cn(
                'rounded-xl border p-3.5 flex items-start gap-3',
                a.isHome
                  ? 'border-[var(--color-brand)]/40 bg-[var(--color-brand)]/5'
                  : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]',
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--color-brand)]/15 flex items-center justify-center font-black text-[var(--color-brand)] text-xs flex-shrink-0 uppercase">
                {(a.tag || a.name).slice(0, 3)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-[var(--color-text-primary)]">{a.name}</span>
                  {a.isHome && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)] text-white">{t('server_home.home_badge')}</span>
                  )}
                  <span
                    className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded',
                      a.recruiting ? 'bg-green-500/15 text-green-400' : 'bg-gray-500/15 text-gray-400',
                    )}
                  >
                    {a.recruiting ? t('server_home.ally_recruiting') : t('server_home.ally_closed')}
                  </span>
                </div>
                {a.note && <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">{a.note}</p>}
                {a.contact && (
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {t('server_home.contact_label')}: {a.contact}
                  </p>
                )}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={() => openEdit(a)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-brand)]">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(a.id)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 추가/수정 모달 */}
      {draft && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                {draft.id ? t('server_home.alliance_edit_title') : t('server_home.alliance_add_title')}
              </h2>
              <button onClick={() => setDraft(null)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('server_home.ally_field_name')} *</label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('server_home.ally_field_tag')}</label>
                <Input value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} placeholder="ONE" />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('server_home.ally_field_contact')}</label>
              <Input value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} placeholder="Discord / KakaoTalk" />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('server_home.ally_field_note')}</label>
              <Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </div>
            <div className="flex gap-2">
              {([
                { key: 'recruiting' as const, label: t('server_home.ally_field_recruiting') },
                { key: 'isHome' as const, label: t('server_home.ally_field_home') },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDraft({ ...draft, [key]: !draft[key] })}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-colors',
                    draft[key]
                      ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                      : 'border-[var(--color-border-subtle)] text-[var(--color-text-muted)]',
                  )}
                >
                  {draft[key] && <Check className="w-3.5 h-3.5" />} {label}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('server_home.ally_field_sort')}</label>
              <Input
                type="number"
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="full" onClick={() => setDraft(null)}>{t('common.cancel')}</Button>
              <Button size="full" disabled={!draft.name.trim() || saving} onClick={handleSave}>
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
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-2">{t('server_home.alliance_delete_title')}</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('server_home.alliance_delete_desc')}</p>
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
