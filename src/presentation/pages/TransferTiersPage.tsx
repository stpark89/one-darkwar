import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, X, Trash2, Loader2, Pencil, Save, Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useTransferTierStore } from '@/infrastructure/stores/transferTierStore'
import type { TransferTier } from '@/domain/entities/TransferTier'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { formatCp } from '@/lib/cp'

interface DraftForm {
  id?: string
  name: string
  minCpStr: string   // 입력은 G/M 단위 문자열로 받음
  maxCpStr: string
  capacityStr: string
  sortOrderStr: string
  seasonName: string
}

const EMPTY: DraftForm = { name: '', minCpStr: '', maxCpStr: '', capacityStr: '0', sortOrderStr: '0', seasonName: '' }

// "3.54G" → 3540, "" → null
const parseInput = (s: string): number | null => {
  const t = s.trim().toUpperCase()
  if (!t) return null
  const num = parseFloat(t.replace(/[^0-9.]/g, ''))
  if (isNaN(num)) return null
  if (t.includes('G') || t.includes('B')) return Math.round(num * 1000)
  return Math.round(num)
}

export const TransferTiersPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ROLE_ADMIN'
  const { tiers, loading, loadAll, upsert, remove } = useTransferTierStore()

  const [draft, setDraft] = useState<DraftForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [loadAll])

  if (!isAdmin) return <Navigate to="/" replace />

  const startEdit = (t: TransferTier) => {
    setDraft({
      id: t.id,
      name: t.name,
      minCpStr: t.minCp > 0 ? formatCp(t.minCp) : '',
      maxCpStr: t.maxCp != null ? formatCp(t.maxCp) : '',
      capacityStr: String(t.capacity),
      sortOrderStr: String(t.sortOrder),
      seasonName: t.seasonName,
    })
  }

  const startNew = () => {
    const nextOrder = tiers.length > 0 ? Math.max(...tiers.map(x => x.sortOrder)) + 1 : 1
    setDraft({ ...EMPTY, sortOrderStr: String(nextOrder) })
  }

  const save = async () => {
    if (!draft || saving) return
    setSaving(true)
    const ok = await upsert({
      id: draft.id,
      name: draft.name.trim(),
      minCp: parseInput(draft.minCpStr) ?? 0,
      maxCp: parseInput(draft.maxCpStr),
      capacity: parseInt(draft.capacityStr, 10) || 0,
      sortOrder: parseInt(draft.sortOrderStr, 10) || 0,
      seasonName: draft.seasonName,
    })
    setSaving(false)
    if (ok) setDraft(null)
  }

  const formatRange = (tier: TransferTier) => {
    const min = tier.minCp > 0 ? formatCp(tier.minCp) : '0'
    const max = tier.maxCp != null ? formatCp(tier.maxCp) : '∞'
    return `${min} ~ ${max}`
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--color-brand)]" />
            {t('tiers.title')}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">{t('tiers.subtitle')}</p>
        </div>
        <Button size="sm" onClick={startNew}>
          <Plus className="w-4 h-4" /> {t('tiers.add_btn')}
        </Button>
      </div>

      {/* 등급 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : tiers.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">{t('tiers.no_data')}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tiers.map((tier) => (
            <div key={tier.id} className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate">{tier.name || '—'}</h3>
                  {tier.seasonName && (
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{tier.seasonName}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 -mt-1 -mr-1">
                  <button onClick={() => startEdit(tier)} className="p-1.5 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(tier.id)} className="p-1.5 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)] transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex gap-2">
                  <span className="text-[var(--color-text-muted)] w-14 flex-shrink-0">{t('tiers.cp_range')}</span>
                  <span className="text-[var(--color-text-primary)] font-medium">{formatRange(tier)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--color-text-muted)] w-14 flex-shrink-0">{t('tiers.capacity')}</span>
                  <span className="text-[var(--color-text-primary)] font-medium">{tier.capacity}{t('common.count_people')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 작성/수정 모달 */}
      {draft && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold">{draft.id ? t('tiers.edit_title') : t('tiers.add_title')}</h2>
              <button onClick={() => setDraft(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] -mr-1 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_name')} *</label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="T1, T2, ..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_min_cp')}</label>
                <Input value={draft.minCpStr} onChange={(e) => setDraft({ ...draft, minCpStr: e.target.value })} placeholder="3G" />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_max_cp')}</label>
                <Input value={draft.maxCpStr} onChange={(e) => setDraft({ ...draft, maxCpStr: e.target.value })} placeholder={t('tiers.unlimited_placeholder')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_capacity')} *</label>
                <Input type="number" value={draft.capacityStr} onChange={(e) => setDraft({ ...draft, capacityStr: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_sort_order')}</label>
                <Input type="number" value={draft.sortOrderStr} onChange={(e) => setDraft({ ...draft, sortOrderStr: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_season')}</label>
              <Input value={draft.seasonName} onChange={(e) => setDraft({ ...draft, seasonName: e.target.value })} placeholder={t('tiers.season_placeholder')} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="full" onClick={() => setDraft(null)}>{t('common.cancel')}</Button>
              <Button size="full" disabled={!draft.name.trim() || saving} onClick={save}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />
              </div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('tiers.delete_title')}</h2>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('tiers.delete_desc')}</p>
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
