import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Send, Loader2, CheckCircle2, XCircle, Clock, Trash2, RotateCcw, Home, Layers, Pencil, Plus, Save, X, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useTransferStore } from '@/infrastructure/stores/transferStore'
import { useTransferTierStore, findTierForCp } from '@/infrastructure/stores/transferTierStore'
import type { TransferStatus } from '@/domain/entities/Transfer'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { parseCp, formatCp } from '@/lib/cp'
import { cn } from '@/lib/utils'

interface TierDraftForm {
  id?: string
  name: string
  minCpStr: string
  maxCpStr: string
  capacityStr: string
  sortOrderStr: string
  seasonName: string
}

const EMPTY_TIER_DRAFT: TierDraftForm = { name: '', minCpStr: '', maxCpStr: '', capacityStr: '0', sortOrderStr: '0', seasonName: '' }

// "3.54G" → 3540, "" → null
const parseTierInput = (s: string): number | null => {
  const t = s.trim().toUpperCase()
  if (!t) return null
  const num = parseFloat(t.replace(/[^0-9.]/g, ''))
  if (isNaN(num)) return null
  if (t.includes('G') || t.includes('B')) return Math.round(num * 1000)
  return Math.round(num)
}

const formatTierRange = (minCp: number, maxCp: number | null) => {
  const min = minCp > 0 ? formatCp(minCp) : '0'
  const max = maxCp != null ? formatCp(maxCp) : '∞'
  return `${min} ~ ${max}`
}

const STATUS_META: Record<TransferStatus, { icon: typeof Clock; color: string; bg: string }> = {
  PENDING: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
  APPROVED: { icon: CheckCircle2, color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/15' },
  REJECTED: { icon: XCircle, color: 'text-[var(--color-danger)]', bg: 'bg-[var(--color-danger)]/15' },
}

// 국가 옵션 — 저장은 코드값(KR/VN/TW/CN/JP/EN/OTHER), 표시는 t()로 다국어 라벨
const COUNTRY_OPTIONS = ['KR', 'VN', 'TW', 'CN', 'JP', 'EN', 'OTHER'] as const
const COUNTRY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', VN: '🇻🇳', TW: '🇹🇼', CN: '🇨🇳', JP: '🇯🇵', EN: '🇺🇸', OTHER: '🌐',
}

export const TransferPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, isGuest } = useAuthStore()
  const isAdmin = user?.role === 'ROLE_ADMIN'

  const { apps, loading, submit, loadAll, updateStatus, remove } = useTransferStore()
  const { tiers, loadAll: loadTiers, upsert: upsertTier, remove: removeTier } = useTransferTierStore()

  const [inGameName, setInGameName] = useState('')
  const [uid, setUid] = useState('')
  const [currentServer, setCurrentServer] = useState('')
  const [country, setCountry] = useState('')
  const [cp, setCp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [tab, setTab] = useState<TransferStatus>('PENDING')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // 국가 셀렉터 드롭다운
  const [countryOpen, setCountryOpen] = useState(false)

  // 등급 편집 (관리자만)
  const [tierEditMode, setTierEditMode] = useState(false)
  const [tierDraft, setTierDraft] = useState<TierDraftForm | null>(null)
  const [tierSaving, setTierSaving] = useState(false)
  const [deleteTierId, setDeleteTierId] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      loadAll()
      loadTiers()
    }
  }, [isAdmin, loadAll, loadTiers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inGameName.trim() || submitting) return
    setSubmitting(true)
    const ok = await submit({ inGameName, uid, currentServer, country, cp })
    setSubmitting(false)
    if (ok) {
      setSubmitted(true)
      setInGameName('')
      setUid('')
      setCurrentServer('')
      setCountry('')
      setCp('')
      if (isAdmin) loadAll()
    }
  }

  const handleResetForm = () => setSubmitted(false)

  // ── 등급 편집 핸들러 ──
  const startEditTier = (id: string) => {
    const tier = tiers.find((t) => t.id === id)
    if (!tier) return
    setTierDraft({
      id: tier.id,
      name: tier.name,
      minCpStr: tier.minCp > 0 ? formatCp(tier.minCp) : '',
      maxCpStr: tier.maxCp != null ? formatCp(tier.maxCp) : '',
      capacityStr: String(tier.capacity),
      sortOrderStr: String(tier.sortOrder),
      seasonName: tier.seasonName,
    })
  }

  const startNewTier = () => {
    const nextOrder = tiers.length > 0 ? Math.max(...tiers.map((x) => x.sortOrder)) + 1 : 1
    setTierDraft({ ...EMPTY_TIER_DRAFT, sortOrderStr: String(nextOrder) })
  }

  const saveTier = async () => {
    if (!tierDraft || tierSaving) return
    setTierSaving(true)
    const ok = await upsertTier({
      id: tierDraft.id,
      name: tierDraft.name.trim(),
      minCp: parseTierInput(tierDraft.minCpStr) ?? 0,
      maxCp: parseTierInput(tierDraft.maxCpStr),
      capacity: parseInt(tierDraft.capacityStr, 10) || 0,
      sortOrder: parseInt(tierDraft.sortOrderStr, 10) || 0,
      seasonName: tierDraft.seasonName,
    })
    setTierSaving(false)
    if (ok) setTierDraft(null)
  }

  const filtered = apps.filter((a) => a.status === tab)
  const counts = {
    PENDING: apps.filter((a) => a.status === 'PENDING').length,
    APPROVED: apps.filter((a) => a.status === 'APPROVED').length,
    REJECTED: apps.filter((a) => a.status === 'REJECTED').length,
  }

  // 승인된 신청자들의 등급별 집계 (capacity 진행률 표시용)
  const approvedByTier = useMemo(() => {
    const map = new Map<string, number>()
    let unmatched = 0
    for (const a of apps) {
      if (a.status !== 'APPROVED') continue
      const tier = findTierForCp(tiers, parseCp(a.cp))
      if (tier) map.set(tier.id, (map.get(tier.id) ?? 0) + 1)
      else unmatched += 1
    }
    return { map, unmatched }
  }, [apps, tiers])

  // 게스트도 관리자도 아닌 일반 회원이 직접 URL로 접근하면 홈으로
  if (!isGuest && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">
          {isAdmin ? t('transfer.admin_title') : t('transfer.title')}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
          {isAdmin ? t('transfer.admin_subtitle') : t('transfer.subtitle')}
        </p>
      </div>

      {/* 신청 폼 또는 완료 카드 — 게스트에게만 노출 */}
      {isGuest && (
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4 sm:p-5 max-w-xl">
        {submitted ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-[var(--color-success)] mx-auto mb-3" />
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-1">{t('transfer.success_title')}</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-5">{t('transfer.success_desc')}</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button variant="outline" size="sm" onClick={handleResetForm}>
                {t('transfer.write_another')}
              </Button>
              <Button size="sm" onClick={() => navigate('/')}>
                <Home className="w-4 h-4" />
                {t('transfer.go_home')}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">{t('transfer.form_title')}</h2>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">{t('transfer.form_hint')}</p>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_name')} *</label>
              <Input
                value={inGameName}
                onChange={(e) => setInGameName(e.target.value)}
                placeholder={t('transfer.field_name_placeholder')}
                required
              />
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_uid')}</label>
              <Input
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder={t('transfer.field_uid_placeholder')}
              />
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_server')}</label>
              <Input
                value={currentServer}
                onChange={(e) => setCurrentServer(e.target.value)}
                placeholder={t('transfer.field_server_placeholder')}
              />
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_country')}</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCountryOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-brand)]/40 transition-colors"
                >
                  {country ? (
                    <span className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                      <span className="text-base leading-none">{COUNTRY_FLAGS[country]}</span>
                      <span>{t(`transfer.country_${country.toLowerCase()}`)}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-[var(--color-text-muted)]">
                      {t('transfer.field_country_placeholder')}
                    </span>
                  )}
                  <ChevronDown className={cn('w-4 h-4 text-[var(--color-text-muted)] transition-transform flex-shrink-0', countryOpen && 'rotate-180')} />
                </button>
                {countryOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCountryOpen(false)} />
                    <div className="absolute left-0 right-0 mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-xl overflow-hidden z-20">
                      {COUNTRY_OPTIONS.map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => { setCountry(code); setCountryOpen(false) }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left',
                            country === code
                              ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] font-semibold'
                              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]',
                          )}
                        >
                          <span className="text-base leading-none">{COUNTRY_FLAGS[code]}</span>
                          {t(`transfer.country_${code.toLowerCase()}`)}
                          {country === code && <span className="ml-auto text-[10px]">✓</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_cp')}</label>
              <Input
                value={cp}
                onChange={(e) => setCp(e.target.value)}
                placeholder={t('transfer.field_cp_placeholder')}
              />
            </div>

            <Button type="submit" size="full" disabled={!inGameName.trim() || submitting} className="mt-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t('transfer.submit_btn')}
            </Button>
          </form>
        )}
      </div>
      )}

      {/* 관리자 전용: 신청서 목록 */}
      {isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">{t('transfer.admin_list_title')}</h2>
            <button onClick={loadAll} className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              <RotateCcw className="w-3 h-3" /> {t('common.search')}
            </button>
          </div>

          {/* 등급별 정원 대시보드 + 인라인 편집 */}
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[var(--color-brand)]" />
                {tierEditMode ? t('tiers.title') : t('transfer.dashboard_title')}
              </h3>
              <div className="flex items-center gap-2">
                {!tierEditMode && (
                  <span className="text-[11px] text-[var(--color-text-muted)]">{t('transfer.dashboard_hint')}</span>
                )}
                <button
                  onClick={() => setTierEditMode((v) => !v)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors',
                    tierEditMode
                      ? 'bg-[var(--color-brand)] text-white'
                      : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]',
                  )}
                >
                  {tierEditMode ? <CheckCircle2 className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                  {tierEditMode ? t('common.close') : t('transfer.edit_tiers_btn')}
                </button>
              </div>
            </div>

            {tiers.length === 0 && !tierEditMode ? (
              <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">{t('tiers.no_data')}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {tiers.map((tier) => {
                  if (tierEditMode) {
                    return (
                      <div key={tier.id} className="group bg-[var(--color-bg-base)] rounded-lg p-2.5 border border-[var(--color-border-subtle)] hover:border-[var(--color-brand)]/40 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{tier.name}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditTier(tier.id)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-brand)]">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => setDeleteTierId(tier.id)} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-[var(--color-text-muted)]">{formatTierRange(tier.minCp, tier.maxCp)}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">{t('tiers.capacity')}: {tier.capacity}</p>
                      </div>
                    )
                  }
                  const cur = approvedByTier.map.get(tier.id) ?? 0
                  const cap = tier.capacity
                  const pct = cap > 0 ? Math.min(100, (cur / cap) * 100) : 0
                  const over = cap > 0 && cur > cap
                  const full = cap > 0 && cur >= cap && !over
                  return (
                    <div key={tier.id} className="bg-[var(--color-bg-base)] rounded-lg p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{tier.name}</span>
                        <span className={cn(
                          'text-[11px] font-bold',
                          over ? 'text-[var(--color-danger)]' : full ? 'text-yellow-400' : 'text-[var(--color-text-secondary)]',
                        )}>
                          {cur}/{cap}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all',
                            over ? 'bg-[var(--color-danger)]' : full ? 'bg-yellow-400' : 'bg-[var(--color-brand)]',
                          )}
                          style={{ width: `${over ? 100 : pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                {tierEditMode && (
                  <button
                    onClick={startNewTier}
                    className="bg-[var(--color-bg-base)] rounded-lg p-2.5 border border-dashed border-[var(--color-border)] hover:border-[var(--color-brand)] hover:bg-[var(--color-bg-elevated)] transition-colors flex items-center justify-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-brand)]"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-xs font-semibold">{t('tiers.add_btn')}</span>
                  </button>
                )}
                {!tierEditMode && approvedByTier.unmatched > 0 && (
                  <div className="bg-[var(--color-bg-base)] rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[var(--color-text-muted)]">{t('transfer.dashboard_unmatched')}</span>
                      <span className="text-[11px] font-bold text-[var(--color-text-muted)]">{approvedByTier.unmatched}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)]" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 탭 */}
          <div className="flex gap-1 p-1 bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border-subtle)] w-fit">
            {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setTab(s)}
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5',
                  tab === s
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                )}
              >
                {t(`transfer.tab_${s.toLowerCase()}`)}
                <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', tab === s ? 'bg-white/20' : 'bg-[var(--color-bg-elevated)]')}>
                  {counts[s]}
                </span>
              </button>
            ))}
          </div>

          {/* 목록 */}
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[var(--color-text-muted)]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">{t('transfer.no_data')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((a) => {
                const meta = STATUS_META[a.status]
                const Icon = meta.icon
                return (
                  <div key={a.id} className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate">{a.inGameName}</h3>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                          {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={cn('flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded', meta.bg, meta.color)}>
                        <Icon className="w-3 h-3" />
                        {t(`transfer.status_${a.status.toLowerCase()}`)}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-[var(--color-text-secondary)] mb-3">
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_uid')}</span>
                        <span className="text-[var(--color-text-primary)] font-mono">{a.uid || '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_server')}</span>
                        <span className="text-[var(--color-text-primary)]">{a.currentServer || '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_country')}</span>
                        <span className="text-[var(--color-text-primary)]">
                          {a.country
                            ? (COUNTRY_OPTIONS.includes(a.country as typeof COUNTRY_OPTIONS[number])
                                ? `${COUNTRY_FLAGS[a.country]} ${t(`transfer.country_${a.country.toLowerCase()}`)}`
                                : a.country)
                            : '—'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_cp')}</span>
                        <span className="text-[var(--color-text-primary)] flex items-center gap-1.5">
                          {a.cp || '—'}
                          {(() => {
                            const tier = findTierForCp(tiers, parseCp(a.cp))
                            return tier
                              ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)]">{tier.name}</span>
                              : null
                          })()}
                        </span>
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex gap-2 pt-3 border-t border-[var(--color-border-subtle)]">
                      {a.status !== 'APPROVED' && (
                        <button
                          onClick={() => user && updateStatus(a.id, 'APPROVED', user.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" /> {t('transfer.approve_btn')}
                        </button>
                      )}
                      {a.status !== 'REJECTED' && (
                        <button
                          onClick={() => user && updateStatus(a.id, 'REJECTED', user.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold bg-[var(--color-danger)]/15 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/25 transition-colors"
                        >
                          <XCircle className="w-3 h-3" /> {t('transfer.reject_btn')}
                        </button>
                      )}
                      {a.status !== 'PENDING' && (
                        <button
                          onClick={() => user && updateStatus(a.id, 'PENDING', user.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold bg-yellow-400/15 text-yellow-400 hover:bg-yellow-400/25 transition-colors"
                        >
                          <Clock className="w-3 h-3" /> {t('transfer.reopen_btn')}
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteConfirmId(a.id)}
                        className="px-2 py-1.5 rounded text-xs font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)] transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />
              </div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('transfer.delete_title')}</h2>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('transfer.delete_desc')}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="full" onClick={() => setDeleteConfirmId(null)}>{t('common.cancel')}</Button>
              <Button size="full" className="bg-[var(--color-danger)] hover:bg-red-700 text-white"
                onClick={async () => { await remove(deleteConfirmId); setDeleteConfirmId(null) }}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TIER 추가/수정 모달 */}
      {tierDraft && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold">{tierDraft.id ? t('tiers.edit_title') : t('tiers.add_title')}</h2>
              <button onClick={() => setTierDraft(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] -mr-1 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_name')} *</label>
              <Input value={tierDraft.name} onChange={(e) => setTierDraft({ ...tierDraft, name: e.target.value })} placeholder="T1, T2, ..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_min_cp')}</label>
                <Input value={tierDraft.minCpStr} onChange={(e) => setTierDraft({ ...tierDraft, minCpStr: e.target.value })} placeholder="3G" />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_max_cp')}</label>
                <Input value={tierDraft.maxCpStr} onChange={(e) => setTierDraft({ ...tierDraft, maxCpStr: e.target.value })} placeholder={t('tiers.unlimited_placeholder')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_capacity')} *</label>
                <Input type="number" value={tierDraft.capacityStr} onChange={(e) => setTierDraft({ ...tierDraft, capacityStr: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_sort_order')}</label>
                <Input type="number" value={tierDraft.sortOrderStr} onChange={(e) => setTierDraft({ ...tierDraft, sortOrderStr: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('tiers.field_season')}</label>
              <Input value={tierDraft.seasonName} onChange={(e) => setTierDraft({ ...tierDraft, seasonName: e.target.value })} placeholder={t('tiers.season_placeholder')} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="full" onClick={() => setTierDraft(null)}>{t('common.cancel')}</Button>
              <Button size="full" disabled={!tierDraft.name.trim() || tierSaving} onClick={saveTier}>
                {tierSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TIER 삭제 확인 모달 */}
      {deleteTierId && (
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
              <Button variant="outline" size="full" onClick={() => setDeleteTierId(null)}>{t('common.cancel')}</Button>
              <Button size="full" className="bg-[var(--color-danger)] hover:bg-red-700 text-white"
                onClick={async () => { await removeTier(deleteTierId); setDeleteTierId(null) }}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
