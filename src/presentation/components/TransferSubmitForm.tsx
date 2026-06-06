// 이주 신청 폼 — 본인/단체 토글 지원.
// 본인 만:  단일 신청 (transfer_applications INSERT 1건)
// 단체:    대표자 정보 + 멤버 N명 → submit_transfer_group RPC 호출
//
// 분리 이유: TransferPage 가 너무 비대해서 폼만 떼어내 보수성 ↑.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Loader2, CheckCircle2, Home, Search, ChevronDown, Plus, X, Users, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useTransferStore } from '@/infrastructure/stores/transferStore'
import { useTransferTierStore, findTierForCp } from '@/infrastructure/stores/transferTierStore'
import type { DesiredAlliance } from '@/domain/entities/Transfer'
import type { TransferTier } from '@/domain/entities/TransferTier'
import { TIER_COLOR_CLASS } from '@/domain/entities/TransferTier'
import { parseCp } from '@/lib/cp'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { cn } from '@/lib/utils'

// 동맹 옵션 (코드값) 와 라벨
const ALLIANCE_OPTIONS: DesiredAlliance[] = ['ONE', 'NXO', 'NH_D', 'OTHER']

const COUNTRY_OPTIONS = ['KR', 'VN', 'TW', 'CN', 'JP', 'EN', 'OTHER'] as const
const COUNTRY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', VN: '🇻🇳', TW: '🇹🇼', CN: '🇨🇳', JP: '🇯🇵', EN: '🇺🇸', OTHER: '🌐',
}

interface MemberRow {
  inGameName: string
  uid: string
  currentServer: string
  country: string
  cp: string
  totalPower: string
  tierId: string | null
}

const emptyMember = (): MemberRow => ({
  inGameName: '',
  uid: '',
  currentServer: '',
  country: '',
  cp: '',
  totalPower: '',
  tierId: null,
})

type Mode = 'solo' | 'group'

export const TransferSubmitForm = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { submit, submitGroup } = useTransferStore()
  const { tiers, loadAll: loadTiers } = useTransferTierStore()

  const [mode, setMode] = useState<Mode>('solo')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // 공통
  const [desiredAlliance, setDesiredAlliance] = useState<DesiredAlliance>('ONE')
  const [desiredAllianceOther, setDesiredAllianceOther] = useState('')
  const [allianceOpen, setAllianceOpen] = useState(false)

  // 본인 만
  const [soloMember, setSoloMember] = useState<MemberRow>(emptyMember())
  const [soloCountryOpen, setSoloCountryOpen] = useState(false)

  // 단체 — 대표자
  const [leaderName, setLeaderName] = useState('')
  const [leaderUid, setLeaderUid] = useState('')
  const [leaderContact, setLeaderContact] = useState('')

  // 단체 — 멤버 동적 리스트 (대표자도 멤버 첫 행으로 포함)
  // 단체 모드 진입 시 기본 1행 만들고, 대표자 정보가 바뀌면 첫 행에 자동 반영
  const [members, setMembers] = useState<MemberRow[]>([emptyMember()])

  useEffect(() => { loadTiers() }, [loadTiers])

  // 대표자 정보가 바뀌면 멤버 리스트 첫 행에 동기화 — 대표자도 이주하는 한 명이므로
  useEffect(() => {
    if (mode !== 'group') return
    setMembers((prev) => {
      if (prev.length === 0) return [{ ...emptyMember(), inGameName: leaderName, uid: leaderUid }]
      const [first, ...rest] = prev
      return [{ ...first, inGameName: leaderName, uid: leaderUid }, ...rest]
    })
  }, [mode, leaderName, leaderUid])

  const handleAddMember = () => setMembers((prev) => [...prev, emptyMember()])

  const handleRemoveMember = (idx: number) => {
    // 첫 행(대표자)은 제거 불가
    if (idx === 0) return
    setMembers((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleMemberChange = (idx: number, patch: Partial<MemberRow>) => {
    setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)))
  }

  const handleReset = () => {
    setSubmitted(false)
    setSoloMember(emptyMember())
    setLeaderName('')
    setLeaderUid('')
    setLeaderContact('')
    setMembers([emptyMember()])
    setDesiredAlliance('ONE')
    setDesiredAllianceOther('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (desiredAlliance === 'OTHER' && !desiredAllianceOther.trim()) {
      toast.error(t('transfer.alliance_other_required'))
      return
    }

    setSubmitting(true)
    let ok = false
    try {
      if (mode === 'solo') {
        if (!soloMember.inGameName.trim()) {
          toast.error(t('transfer.field_name_required'))
          return
        }
        ok = await submit({
          inGameName: soloMember.inGameName,
          uid: soloMember.uid,
          currentServer: soloMember.currentServer,
          country: soloMember.country,
          cp: soloMember.cp,
          totalPower: soloMember.totalPower,
          tierId: soloMember.tierId,
          desiredAlliance,
          desiredAllianceOther,
        })
      } else {
        if (!leaderName.trim()) {
          toast.error(t('transfer.leader_name_required'))
          return
        }
        // 빈 멤버 행 제거 (이름이 비어있는 행)
        const validMembers = members.filter((m) => m.inGameName.trim() !== '')
        if (validMembers.length === 0) {
          toast.error(t('transfer.no_members'))
          return
        }
        const groupId = await submitGroup({
          leaderName,
          leaderUid,
          leaderContact,
          desiredAlliance,
          desiredAllianceOther,
          members: validMembers,
        })
        ok = groupId !== null
      }
    } catch (err) {
      console.error('[TransferSubmitForm] submit exception:', err)
    } finally {
      setSubmitting(false)
    }
    if (ok) setSubmitted(true)
  }

  const allianceLabel = (a: DesiredAlliance) => {
    if (a === 'OTHER') return t('transfer.alliance_other')
    if (a === 'NH_D') return 'NH-D'
    return a
  }

  // ──── 완료 화면 ────
  if (submitted) {
    return (
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4 sm:p-5 max-w-xl text-center py-6">
        <CheckCircle2 className="w-12 h-12 text-[var(--color-success)] mx-auto mb-3" />
        <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-1">{t('transfer.success_title')}</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-2 break-keep">{t('transfer.success_desc')}</p>
        <p className="text-xs text-[var(--color-text-muted)] mb-5 break-keep">{t('transfer.success_check_hint')}</p>
        <div className="flex gap-2 justify-center flex-wrap">
          <Button variant="outline" size="sm" onClick={handleReset}>
            {t('transfer.write_another')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/transfer/status')}>
            <Search className="w-4 h-4" />
            {t('transfer.check_status')}
          </Button>
          <Button size="sm" onClick={() => navigate('/')}>
            <Home className="w-4 h-4" />
            {t('transfer.go_home')}
          </Button>
        </div>
      </div>
    )
  }

  // ──── 폼 ────
  return (
    <form onSubmit={handleSubmit} className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4 sm:p-5 max-w-xl space-y-3 break-keep">
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">{t('transfer.form_title')}</h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">{t('transfer.form_hint')}</p>

      {/* 모드 토글 */}
      <div className="flex gap-1 p-1 bg-[var(--color-bg-elevated)] rounded-lg">
        <button
          type="button"
          onClick={() => setMode('solo')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-semibold transition-colors',
            mode === 'solo'
              ? 'bg-[var(--color-brand)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
          )}
        >
          <User className="w-3.5 h-3.5" /> {t('transfer.mode_solo')}
        </button>
        <button
          type="button"
          onClick={() => setMode('group')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-semibold transition-colors',
            mode === 'group'
              ? 'bg-[var(--color-brand)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
          )}
        >
          <Users className="w-3.5 h-3.5" /> {t('transfer.mode_group')}
        </button>
      </div>

      {/* 희망 동맹 (공통) */}
      <div>
        <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('transfer.field_alliance')} *</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setAllianceOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-brand)]/40 transition-colors"
          >
            <span className="text-sm text-[var(--color-text-primary)]">{allianceLabel(desiredAlliance)}</span>
            <ChevronDown className={cn('w-4 h-4 text-[var(--color-text-muted)] transition-transform flex-shrink-0', allianceOpen && 'rotate-180')} />
          </button>
          {allianceOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAllianceOpen(false)} />
              <div className="absolute left-0 right-0 mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-xl overflow-hidden z-20">
                {ALLIANCE_OPTIONS.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => { setDesiredAlliance(code); setAllianceOpen(false) }}
                    className={cn(
                      'w-full flex items-center px-3 py-2.5 text-sm transition-colors text-left',
                      desiredAlliance === code
                        ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] font-semibold'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]',
                    )}
                  >
                    {allianceLabel(code)}
                    {desiredAlliance === code && <span className="ml-auto text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {desiredAlliance === 'OTHER' && (
          <Input
            value={desiredAllianceOther}
            onChange={(e) => setDesiredAllianceOther(e.target.value)}
            placeholder={t('transfer.alliance_other_placeholder')}
            className="mt-2"
          />
        )}
      </div>

      {/* === 본인 만 === */}
      {mode === 'solo' && (
        <MemberFields
          value={soloMember}
          onChange={(patch) => setSoloMember((prev) => ({ ...prev, ...patch }))}
          tiers={tiers}
          countryOpen={soloCountryOpen}
          setCountryOpen={setSoloCountryOpen}
          showLabel={false}
        />
      )}

      {/* === 단체 === */}
      {mode === 'group' && (
        <>
          {/* 대표자 */}
          <div className="space-y-2 p-3 rounded-lg bg-[var(--color-brand)]/5 border border-[var(--color-brand)]/20">
            <p className="text-xs font-semibold text-[var(--color-brand)] flex items-center gap-1">
              <Users className="w-3 h-3" /> {t('transfer.leader_section')}
            </p>
            <Input
              value={leaderName}
              onChange={(e) => setLeaderName(e.target.value)}
              placeholder={t('transfer.leader_name_placeholder')}
              required
            />
            <Input
              value={leaderUid}
              onChange={(e) => setLeaderUid(e.target.value)}
              placeholder={t('transfer.leader_uid_placeholder')}
            />
            <Input
              value={leaderContact}
              onChange={(e) => setLeaderContact(e.target.value)}
              placeholder={t('transfer.leader_contact_placeholder')}
            />
            <p className="text-[10px] text-[var(--color-text-muted)]">{t('transfer.leader_hint')}</p>
          </div>

          {/* 멤버 리스트 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                {t('transfer.members_section', { n: members.length })}
              </p>
              <button
                type="button"
                onClick={handleAddMember}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
              >
                <Plus className="w-3 h-3" /> {t('transfer.add_member_btn')}
              </button>
            </div>
            {members.map((m, idx) => (
              <MemberCard
                key={idx}
                index={idx}
                value={m}
                onChange={(patch) => handleMemberChange(idx, patch)}
                onRemove={() => handleRemoveMember(idx)}
                removable={idx !== 0}
                isLeader={idx === 0}
                tiers={tiers}
              />
            ))}
          </div>
        </>
      )}

      <Button type="submit" size="full" disabled={submitting} className="mt-2">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {t('transfer.submit_btn')}
      </Button>
    </form>
  )
}

// ─────────────────────────────────────────────────────────
// MemberCard — 단체 신청에서 멤버 1명 한 행 (펼침형)
// ─────────────────────────────────────────────────────────

interface MemberCardProps {
  index: number
  value: MemberRow
  onChange: (patch: Partial<MemberRow>) => void
  onRemove: () => void
  removable: boolean
  isLeader: boolean
  tiers: TransferTier[]
}

const MemberCard = ({ index, value, onChange, onRemove, removable, isLeader, tiers }: MemberCardProps) => {
  const { t } = useTranslation()
  const [countryOpen, setCountryOpen] = useState(false)

  return (
    <div className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
          #{index + 1}
          {isLeader && (
            <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)] text-white">
              {t('transfer.leader_badge')}
            </span>
          )}
        </p>
        {removable && (
          <button type="button" onClick={onRemove} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <MemberFields
        value={value}
        onChange={onChange}
        tiers={tiers}
        countryOpen={countryOpen}
        setCountryOpen={setCountryOpen}
        showLabel={false}
        // 대표자 행에선 인게임명/UID 가 readOnly (대표자 입력란이 source of truth)
        disabledNameUid={isLeader}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// MemberFields — 한 명의 정보 입력 필드 모음 (재사용)
// ─────────────────────────────────────────────────────────

interface MemberFieldsProps {
  value: MemberRow
  onChange: (patch: Partial<MemberRow>) => void
  tiers: TransferTier[]
  countryOpen: boolean
  setCountryOpen: (v: boolean) => void
  showLabel?: boolean
  disabledNameUid?: boolean
}

const MemberFields = ({
  value, onChange, tiers, countryOpen, setCountryOpen, disabledNameUid,
}: MemberFieldsProps) => {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <Input
        value={value.inGameName}
        onChange={(e) => onChange({ inGameName: e.target.value })}
        placeholder={t('transfer.field_name_placeholder')}
        required
        disabled={disabledNameUid}
        className={disabledNameUid ? 'opacity-60 cursor-not-allowed' : ''}
      />
      <Input
        value={value.uid}
        onChange={(e) => onChange({ uid: e.target.value })}
        placeholder={t('transfer.field_uid_placeholder')}
        disabled={disabledNameUid}
        className={disabledNameUid ? 'opacity-60 cursor-not-allowed' : ''}
      />
      <Input
        value={value.currentServer}
        onChange={(e) => onChange({ currentServer: e.target.value })}
        placeholder={t('transfer.field_server_placeholder')}
      />

      {/* 국가 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setCountryOpen(!countryOpen)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] hover:border-[var(--color-brand)]/40 transition-colors text-sm"
        >
          {value.country ? (
            <span className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <span className="text-base leading-none">{COUNTRY_FLAGS[value.country]}</span>
              <span>{t(`transfer.country_${value.country.toLowerCase()}`)}</span>
            </span>
          ) : (
            <span className="text-[var(--color-text-muted)]">{t('transfer.field_country_placeholder')}</span>
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
                  onClick={() => { onChange({ country: code }); setCountryOpen(false) }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left',
                    value.country === code
                      ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] font-semibold'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]',
                  )}
                >
                  <span className="text-base leading-none">{COUNTRY_FLAGS[code]}</span>
                  {t(`transfer.country_${code.toLowerCase()}`)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 부대 전투력 (1팀 최대 파워 — 참고용) */}
      <Input
        value={value.cp}
        onChange={(e) => onChange({ cp: e.target.value })}
        placeholder={t('transfer.field_cp_placeholder')}
      />

      {/* 합산 전투력 (건물+과학기술+영웅+개조차) → 등급 자동 매칭 */}
      <Input
        value={value.totalPower}
        onChange={(e) => onChange({ totalPower: e.target.value })}
        placeholder={t('transfer.field_total_power_placeholder')}
      />
      {value.totalPower.trim() !== '' && tiers.length > 0 && (() => {
        const tier = findTierForCp(tiers, parseCp(value.totalPower))
        return tier ? (
          <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5">
            {t('transfer.auto_tier')}:
            <span className={cn('font-bold px-1.5 py-0.5 rounded', TIER_COLOR_CLASS[tier.color].badge)}>{tier.name}</span>
          </p>
        ) : null
      })()}
    </div>
  )
}
