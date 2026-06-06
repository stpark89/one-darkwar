import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, CheckCircle2, XCircle, Clock, ArrowLeft, MessageSquare, Languages, Pencil, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTransferStore } from '@/infrastructure/stores/transferStore'
import { useTransferTierStore, findTierForCp } from '@/infrastructure/stores/transferTierStore'
import type { TransferApplication, TransferDraft, TransferStatus } from '@/domain/entities/Transfer'
import { TIER_COLOR_CLASS } from '@/domain/entities/TransferTier'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { TierReference } from '@/presentation/components/TierReference'
import { translateText } from '@/lib/translate'
import { parseCp } from '@/lib/cp'
import { cn } from '@/lib/utils'

const STATUS_META: Record<TransferStatus, { icon: typeof Clock; color: string; bg: string }> = {
  PENDING: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
  APPROVED: { icon: CheckCircle2, color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/15' },
  REJECTED: { icon: XCircle, color: 'text-[var(--color-danger)]', bg: 'bg-[var(--color-danger)]/15' },
}

const COUNTRY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', VN: '🇻🇳', TW: '🇹🇼', CN: '🇨🇳', JP: '🇯🇵', EN: '🇺🇸', OTHER: '🌐',
}
const COUNTRY_OPTIONS = ['KR', 'VN', 'TW', 'CN', 'JP', 'EN', 'OTHER'] as const

export const TransferStatusPage = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { lookupByCredentials, updateApplication } = useTransferStore()
  const { tiers, loadAll: loadTiers } = useTransferTierStore()

  const [uid, setUid] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState<TransferApplication[]>([])

  // 수정 모드
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<TransferDraft | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [countryOpen, setCountryOpen] = useState(false)

  // 번역 토글 상태 — 신청 id → 번역된 텍스트
  const [translations, setTranslations] = useState<Map<string, string>>(new Map())
  const [translating, setTranslating] = useState<Set<string>>(new Set())

  const handleTranslate = async (id: string, original: string) => {
    // 이미 번역 표시 중이면 원문으로 복귀
    if (translations.has(id)) {
      setTranslations((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      return
    }
    if (!original.trim()) return
    setTranslating((prev) => new Set(prev).add(id))
    try {
      const translated = await translateText(original, i18n.language)
      setTranslations((prev) => new Map(prev).set(id, translated))
    } catch (err) {
      console.error('[TransferStatus] translate error', err)
    } finally {
      setTranslating((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uid.trim() || loading) return
    setLoading(true)
    try {
      // 등급 이름 표시용 로드 (실패해도 본 기능에 영향 없음)
      if (tiers.length === 0) loadTiers()
      const found = await lookupByCredentials(uid)
      setResults(found)
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setSearched(false)
    setResults([])
    setEditingId(null)
    setEditDraft(null)
  }

  const openEdit = (a: TransferApplication) => {
    setEditDraft({
      inGameName: a.inGameName,
      uid: a.uid,
      currentServer: a.currentServer,
      country: a.country,
      cp: a.cp,
      totalPower: a.totalPower,
      tierId: a.tierId,
      desiredAlliance: a.desiredAlliance,
      desiredAllianceOther: a.desiredAllianceOther,
    })
    setEditingId(a.id)
  }

  const handleEditSave = async () => {
    if (!editingId || !editDraft || editSaving) return
    setEditSaving(true)
    try {
      const ok = await updateApplication(editingId, editDraft)
      if (ok) {
        // 결과 로컬 갱신
        setResults((prev) =>
          prev.map((a) =>
            a.id === editingId
              ? { ...a, ...editDraft, status: 'PENDING' as TransferStatus, reviewedAt: null, reviewedBy: null }
              : a,
          ),
        )
        setEditingId(null)
        setEditDraft(null)
      }
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-xl mx-auto space-y-5 break-keep">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('transfer_status.title')}</h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">{t('transfer_status.subtitle')}</p>
        </div>
      </div>

      {/* 조회 폼 */}
      {!searched && (
        <form onSubmit={handleSearch} className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-5 space-y-3">
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_uid')} *</label>
            <Input
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder={t('transfer.field_uid_placeholder')}
              required
              autoFocus
            />
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{t('transfer_status.uid_hint')}</p>
          </div>
          <Button type="submit" size="full" disabled={!uid.trim() || loading} className="mt-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {t('transfer_status.search_btn')}
          </Button>
        </form>
      )}

      {/* 조회 결과 */}
      {searched && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
              {t('transfer_status.results_title', { count: results.length })}
            </h2>
            <button
              onClick={handleReset}
              className="text-xs text-[var(--color-brand)] hover:underline"
            >
              {t('transfer_status.search_again')}
            </button>
          </div>

          {results.length === 0 ? (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-6 text-center">
              <p className="text-sm text-[var(--color-text-muted)] mb-2">{t('transfer_status.no_match')}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{t('transfer_status.no_match_hint')}</p>
            </div>
          ) : (
            results.map((a) => {
              const meta = STATUS_META[a.status]
              const Icon = meta.icon
              const tier = a.tierId ? tiers.find((tt) => tt.id === a.tierId) : null
              return (
                <div key={a.id} className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-5 space-y-3">
                  {/* 상태 배지 + 수정 버튼 */}
                  <div className="flex items-center gap-2">
                    <div className={cn('flex items-center gap-3 px-4 py-3 rounded-lg flex-1', meta.bg)}>
                      <Icon className={cn('w-6 h-6 flex-shrink-0', meta.color)} />
                      <div className="min-w-0">
                        <p className={cn('text-base font-bold', meta.color)}>
                          {t(`transfer_status.status_${a.status.toLowerCase()}_title`)}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          {t(`transfer_status.status_${a.status.toLowerCase()}_desc`)}
                        </p>
                      </div>
                    </div>
                    {/* PENDING 또는 REJECTED 일 때만 수정 버튼 노출 */}
                    {(a.status === 'PENDING' || a.status === 'REJECTED') && editingId !== a.id && (
                      <button
                        onClick={() => openEdit(a)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 border border-[var(--color-border-subtle)] transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {t('common.edit')}
                      </button>
                    )}
                  </div>

                  {/* 수정 폼 */}
                  {editingId === a.id && editDraft && (
                    <div className="border border-[var(--color-brand)]/40 rounded-xl p-4 space-y-3 bg-[var(--color-brand)]/5">
                      <p className="text-xs font-bold text-[var(--color-brand)]">{t('transfer_status.edit_title')}</p>

                      {/* 인게임명 */}
                      <div>
                        <label className="text-[11px] text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_name')} *</label>
                        <Input value={editDraft.inGameName} onChange={(e) => setEditDraft((d) => d && ({ ...d, inGameName: e.target.value }))} />
                      </div>
                      {/* 현재 서버 */}
                      <div>
                        <label className="text-[11px] text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_server')}</label>
                        <Input value={editDraft.currentServer} onChange={(e) => setEditDraft((d) => d && ({ ...d, currentServer: e.target.value }))} placeholder={t('transfer.field_server_placeholder')} />
                      </div>
                      {/* 국가 */}
                      <div>
                        <label className="text-[11px] text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_country')}</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setCountryOpen((o) => !o)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-sm text-[var(--color-text-primary)]"
                          >
                            <span>
                              {editDraft.country
                                ? `${COUNTRY_FLAGS[editDraft.country] ?? '🌐'} ${t(`transfer.country_${editDraft.country.toLowerCase()}`, { defaultValue: editDraft.country })}`
                                : <span className="text-[var(--color-text-muted)]">{t('transfer.select_country')}</span>}
                            </span>
                            <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                          </button>
                          {countryOpen && (
                            <div className="absolute z-50 mt-1 w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden">
                              {COUNTRY_OPTIONS.map((c) => (
                                <button key={c} type="button"
                                  onClick={() => { setEditDraft((d) => d && ({ ...d, country: c })); setCountryOpen(false) }}
                                  className={cn('w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-[var(--color-bg-elevated)] transition-colors',
                                    editDraft.country === c && 'text-[var(--color-brand)] font-semibold')}
                                >
                                  <span>{COUNTRY_FLAGS[c]}</span>
                                  <span>{t(`transfer.country_${c.toLowerCase()}`, { defaultValue: c })}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* 부대 전투력 (참고용) */}
                      <div>
                        <label className="text-[11px] text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_cp')}</label>
                        <Input
                          value={editDraft.cp}
                          onChange={(e) => setEditDraft((d) => d && ({ ...d, cp: e.target.value }))}
                          placeholder={t('transfer.field_cp_placeholder')}
                        />
                      </div>
                      {/* 합산 전투력 (건물+과학기술+영웅+개조차) → 등급 자동 매칭 */}
                      <div>
                        <label className="text-[11px] text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_total_power')}</label>
                        <Input
                          value={editDraft.totalPower}
                          onChange={(e) => setEditDraft((d) => d && ({ ...d, totalPower: e.target.value }))}
                          placeholder={t('transfer.field_total_power_placeholder')}
                        />
                        {editDraft.totalPower.trim() !== '' && tiers.length > 0 && (() => {
                          const tier = findTierForCp(tiers, parseCp(editDraft.totalPower))
                          return tier ? (
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5">
                              {t('transfer.auto_tier')}:
                              <span className={cn('font-bold px-1.5 py-0.5 rounded', TIER_COLOR_CLASS[tier.color].badge)}>{tier.name}</span>
                            </p>
                          ) : null
                        })()}
                        <div className="mt-2">
                          <TierReference />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="full" onClick={() => { setEditingId(null); setEditDraft(null) }} disabled={editSaving}>
                          {t('common.cancel')}
                        </Button>
                        <Button size="full" onClick={handleEditSave} disabled={!editDraft.inGameName.trim() || editSaving}>
                          {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {t('transfer_status.edit_submit')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* 관리자 메시지 */}
                  {a.adminMessage && (
                    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-[var(--color-brand)]" />
                          <p className="text-[11px] font-semibold text-[var(--color-brand)]">{t('transfer_status.admin_message_label')}</p>
                        </div>
                        <button
                          onClick={() => handleTranslate(a.id, a.adminMessage)}
                          disabled={translating.has(a.id)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-brand)] transition-colors disabled:opacity-50"
                        >
                          {translating.has(a.id)
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Languages className="w-3 h-3" />}
                          {translations.has(a.id) ? t('questions.show_original') : t('questions.translate_btn')}
                        </button>
                      </div>
                      <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed break-words">
                        {translations.get(a.id) ?? a.adminMessage}
                      </p>
                    </div>
                  )}

                  {/* 신청 정보 요약 */}
                  <div className="space-y-1.5 text-xs text-[var(--color-text-secondary)] pt-3 border-t border-[var(--color-border-subtle)]">
                    <p className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1.5">{t('transfer_status.my_info')}</p>
                    <div className="flex gap-2">
                      <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_name')}</span>
                      <span className="text-[var(--color-text-primary)]">{a.inGameName}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_uid')}</span>
                      <span className="text-[var(--color-text-primary)] font-mono">{a.uid}</span>
                    </div>
                    {a.currentServer && (
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_server')}</span>
                        <span className="text-[var(--color-text-primary)]">{a.currentServer}</span>
                      </div>
                    )}
                    {a.country && (
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_country')}</span>
                        <span className="text-[var(--color-text-primary)]">
                          {COUNTRY_FLAGS[a.country] ?? '🌐'} {t(`transfer.country_${a.country.toLowerCase()}`, { defaultValue: a.country })}
                        </span>
                      </div>
                    )}
                    {tier && (
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_tier')}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)]">{tier.name}</span>
                      </div>
                    )}
                    {a.cp && (
                      <div className="flex gap-2">
                        <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer.field_cp')}</span>
                        <span className="text-[var(--color-text-primary)]">{a.cp}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{t('transfer_status.submitted_at')}</span>
                      <span className="text-[var(--color-text-primary)]">{new Date(a.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
