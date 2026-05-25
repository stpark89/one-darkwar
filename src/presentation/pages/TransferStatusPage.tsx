import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, CheckCircle2, XCircle, Clock, ArrowLeft, MessageSquare, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTransferStore } from '@/infrastructure/stores/transferStore'
import { useTransferTierStore } from '@/infrastructure/stores/transferTierStore'
import type { TransferApplication, TransferStatus } from '@/domain/entities/Transfer'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { translateText } from '@/lib/translate'
import { cn } from '@/lib/utils'

const STATUS_META: Record<TransferStatus, { icon: typeof Clock; color: string; bg: string }> = {
  PENDING: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
  APPROVED: { icon: CheckCircle2, color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/15' },
  REJECTED: { icon: XCircle, color: 'text-[var(--color-danger)]', bg: 'bg-[var(--color-danger)]/15' },
}

const COUNTRY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', VN: '🇻🇳', TW: '🇹🇼', CN: '🇨🇳', JP: '🇯🇵', EN: '🇺🇸', OTHER: '🌐',
}

export const TransferStatusPage = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { lookupByCredentials } = useTransferStore()
  const { tiers, loadAll: loadTiers } = useTransferTierStore()

  const [uid, setUid] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState<TransferApplication[]>([])

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
                  {/* 상태 배지 큼지막하게 */}
                  <div className={cn('flex items-center gap-3 px-4 py-3 rounded-lg', meta.bg)}>
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
