import { useEffect, useState } from 'react'
import { CalendarRange, ChevronDown, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  useTransferSeasonStore,
  openNewTransferSeason,
} from '@/infrastructure/stores/transferSeasonStore'
import { useTransferStore } from '@/infrastructure/stores/transferStore'
import { useTransferTierStore } from '@/infrastructure/stores/transferTierStore'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { cn } from '@/lib/utils'
import { Trans, useTranslation } from 'react-i18next'

/**
 * 관리자 전용 이주 시즌 바 — 어느 시즌을 보고 있는지 알리고, 과거 시즌 열람과
 * 새 시즌 개시를 담당한다. 신청자 화면에는 나오지 않는다(항상 활성 시즌).
 */
export const SeasonBar = () => {
  const { t } = useTranslation()
  const { seasons, activeSeasonId, selectedSeasonId, load, selectSeason } = useTransferSeasonStore()
  const [open, setOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [load])

  // 시즌을 바꾸면 신청·등급 캐시를 버리고 다시 읽는다.
  // 두 스토어 모두 initialized 가드가 있어 리셋 없이는 이전 시즌이 그대로 남는다.
  const reloadForSeason = async () => {
    useTransferStore.setState({ initialized: false })
    useTransferTierStore.setState({ initialized: false })
    await Promise.all([
      useTransferStore.getState().loadAll(true),
      useTransferTierStore.getState().loadAll(true),
    ])
  }

  const handleSelect = async (id: string) => {
    setOpen(false)
    if (id === selectedSeasonId) return
    selectSeason(id)
    await reloadForSeason()
  }

  const handleCreate = async () => {
    setSaving(true)
    const ok = await openNewTransferSeason(newName)
    setSaving(false)
    if (!ok) return
    setNewName('')
    setNewOpen(false)
    await reloadForSeason()
    toast.success(t('season.opened'))
  }

  if (seasons.length === 0) return null

  const current = seasons.find((s) => s.id === selectedSeasonId)
  const viewingPast = !!selectedSeasonId && selectedSeasonId !== activeSeasonId

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border',
          viewingPast
            ? 'bg-amber-500/10 border-amber-500/40'
            : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)]',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarRange
            className={cn(
              'w-4 h-4 flex-shrink-0',
              viewingPast ? 'text-amber-500' : 'text-[var(--color-brand)]',
            )}
          />
          <div className="min-w-0">
            <div className="text-xs font-bold text-[var(--color-text-primary)] truncate">
              {current?.name ?? t('season.unnamed')}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">
              {viewingPast ? t('season.viewing_past') : t('season.accepting')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] transition-colors"
            >
              {t('season.menu')} <ChevronDown className="w-3 h-3" />
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                <div className="absolute right-0 mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-xl overflow-hidden z-20 min-w-[200px]">
                  {seasons.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelect(s.id)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left hover:bg-[var(--color-bg-elevated)] transition-colors"
                    >
                      <span className="truncate text-[var(--color-text-primary)]">{s.name}</span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        {s.isActive && (
                          <span className="text-[10px] font-bold text-[var(--color-brand)]">{t('season.active')}</span>
                        )}
                        {s.id === selectedSeasonId && <Check className="w-3 h-3 text-[var(--color-brand)]" />}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setNewOpen((v) => !v)}
            title={t('season.open_new')}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-[var(--color-brand)] hover:bg-[var(--color-bg-surface)] transition-colors"
          >
            <Plus className="w-3 h-3" /> {t('season.new_btn')}
          </button>
        </div>
      </div>

      {newOpen && (
        <div className="px-3 py-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] space-y-2">
          <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
            <Trans i18nKey="season.new_desc_1" components={{ b: <b /> }} />
            <br />
            <Trans i18nKey="season.new_desc_2" components={{ b: <b /> }} />
          </p>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('season.name_placeholder')}
          />
          <div className="flex gap-2">
            <Button size="full" disabled={!newName.trim() || saving} onClick={handleCreate}>
              {saving ? t('season.opening') : t('season.open_new')}
            </Button>
            <Button size="full" variant="outline" onClick={() => setNewOpen(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
