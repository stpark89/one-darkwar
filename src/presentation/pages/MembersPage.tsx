import { useState, useEffect } from 'react'
import { Search, Plus, Pencil, Trash2, X, Loader2, AlertTriangle, Eye, EyeOff, RotateCcw, ListFilter } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemberStore } from '@/infrastructure/stores/memberStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { Badge } from '@/presentation/components/ui/badge'
import { SortIcon, nextSortDir } from '@/presentation/components/ui/sort-icon'
import type { SortDir } from '@/presentation/components/ui/sort-icon'
import type { Member, OnlineStatus } from '@/domain/entities/Member'
import { TROOP_TYPES, ONLINE_STATUSES } from '@/domain/entities/Member'

const EMPTY: Partial<Member> = { inGameName: '', zaloName: '', cp: '', houseLevel: '', troopType: '', onlineStatus: 'none', note: '' }

const parseCp = (cp: string) => {
  const v = parseFloat(cp)
  if (isNaN(v)) return 0
  if (cp.toUpperCase().includes('G')) return v * 1000
  if (cp.toUpperCase().includes('M')) return v
  return v
}

type SortKey = 'inGameName' | 'cp' | 'houseLevel'

export const MembersPage = () => {
  const { t } = useTranslation()
  const { getFiltered, searchQuery, setSearchQuery, addMember, updateMember, setOnlineStatus, resetAllOnline, deleteMember, loadMembers, loading } = useMemberStore()
  const { user, isGuest } = useAuthStore()
  const canEdit = user?.role === 'ROLE_ADMIN'
  const showUid = !isGuest
  const canEditRow = (m: Member) => canEdit || m.inGameName === user?.inGameName
  const base = getFiltered()

  const [form, setForm] = useState<Partial<Member> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Member | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('cp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  // Online(주말 이벤트) 컬럼 표시 여부 — 전역이 아니라 접속한 사용자별 로컬 설정
  const [showOnline, setShowOnline] = useState<boolean>(() => {
    try { return localStorage.getItem('odw_show_online') === '1' } catch { return false }
  })
  const toggleOnline = () => {
    setShowOnline((v) => {
      const next = !v
      try { localStorage.setItem('odw_show_online', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }
  const [filterOnlineOnly, setFilterOnlineOnly] = useState(false)
  const [filterTroopType, setFilterTroopType] = useState<string | null>(null)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  const confirmDelete = async () => {
    if (!deleteConfirm || deleting) return
    setDeleting(true)
    try {
      await deleteMember(deleteConfirm.id)
      setDeleteConfirm(null)
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => { loadMembers() }, [loadMembers])

  // 페이지 이탈 시 검색어 초기화 — 다른 화면 갔다 돌아왔을 때 옛 검색어가 남아있는 문제 방지
  useEffect(() => {
    return () => { setSearchQuery('') }
  }, [setSearchQuery])

  // 내 행의 멤버 id — 본인 정보 강조 표시용
  const myMemberId = user && !canEdit
    ? base.find((m) => m.inGameName === user.inGameName)?.id ?? null
    : null

  const handleSort = (key: SortKey) => {
    if (key !== sortKey) { setSortKey(key); setSortDir(key === 'cp' ? 'desc' : 'asc'); return }
    const next = nextSortDir(sortDir, key === 'cp')
    setSortDir(next)
    if (next === null) { setSortKey('cp'); setSortDir('desc') }
  }

  const yesCount = base.filter((m) => m.onlineStatus === 'yes').length
  const troopCounts = Object.fromEntries(TROOP_TYPES.map((tp) => [tp, base.filter((m) => m.troopType === tp).length]))
  const displayList = base
    .filter((m) => !filterOnlineOnly || m.onlineStatus === 'yes')
    .filter((m) => !filterTroopType || m.troopType === filterTroopType)

  const members = [...displayList].sort((a, b) => {
    if (!sortDir) return 0
    let cmp = 0
    if (sortKey === 'cp') cmp = parseCp(a.cp) - parseCp(b.cp)
    else if (sortKey === 'inGameName') cmp = a.inGameName.localeCompare(b.inGameName)
    else if (sortKey === 'houseLevel') cmp = a.houseLevel.localeCompare(b.houseLevel)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const openAdd = () => { setForm({ ...EMPTY }); setEditId(null) }
  const openEdit = (m: Member) => { setForm({ ...m }); setEditId(m.id) }
  const closeForm = () => { setForm(null); setEditId(null) }

  const handleSave = async () => {
    if (!form?.inGameName?.trim() || saving) return
    setSaving(true)
    try {
      if (editId) {
        const ok = await updateMember(editId, form)
        if (ok) closeForm()
      } else {
        await addMember({ inGameName: form.inGameName!, ...form })
        closeForm()
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading && members.length === 0) return (
    <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
    </div>
  )

  const th = (key: SortKey, label: string, center = false) => (
    <th
      onClick={() => handleSort(key)}
      className={`px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors ${center ? 'text-center' : 'text-left'}`}
    >
      {label}
      <SortIcon dir={sortKey === key ? sortDir : null} />
    </th>
  )

  return (
    <div className="p-3 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('members.title')}</h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
            {t('members.subtitle_count', { count: members.length })}
          </p>
        </div>
        {canEdit && (
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('members.add_btn')}</span>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('members.search_placeholder')}
            className="pl-9"
          />
        </div>
        {/* Online Yes만 필터 */}
        <button
          onClick={() => setFilterOnlineOnly((v) => !v)}
          title={t('members.online_filter_yes')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap flex-shrink-0 ${
            filterOnlineOnly
              ? 'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30'
              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          {t('members.online_filter_yes')}
          {yesCount > 0 && (
            <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full leading-none ${
              filterOnlineOnly ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]'
            }`}>
              {yesCount}
            </span>
          )}
        </button>
        {/* Online 컬럼 표시/숨김 — 내 화면에만 적용 (로컬) */}
        <button
          onClick={toggleOnline}
          title={t('members.online_toggle_hint')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap flex-shrink-0 ${
            showOnline
              ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] border-[var(--color-brand)]/30'
              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          {showOnline ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {t('members.online')}
        </button>
      </div>

      {/* 병종 필터 버튼 */}
      <div className="flex items-center gap-1.5 mb-3 sm:mb-4 flex-wrap">
        {TROOP_TYPES.map((tp) => (
          <button
            key={tp}
            onClick={() => setFilterTroopType((v) => (v === tp ? null : tp))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
              filterTroopType === tp
                ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] border-[var(--color-brand)]/30'
                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {t(`members.troop_${tp}`)}
            <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full leading-none ${
              filterTroopType === tp ? 'bg-[var(--color-brand)] text-white' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]'
            }`}>
              {troopCounts[tp] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* 비관리자 사용자에게 본인 정보 수정 안내 — 발견율 개선 */}
      {!canEdit && myMemberId && (
        <div className="mb-3 sm:mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/30">
          <Pencil className="w-3.5 h-3.5 text-[var(--color-brand)] flex-shrink-0" />
          <p className="text-[11px] sm:text-xs text-[var(--color-brand)] break-keep flex-1">
            {t('members.self_edit_hint')}
          </p>
        </div>
      )}

      <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap w-8 sm:w-10">
                {t('members.col_no')}
              </th>
              {th('inGameName', t('members.in_game_name'))}
              {showUid && (
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">
                  {t('members.zalo_name')}
                </th>
              )}
              {th('cp', t('members.cp'))}
              {th('houseLevel', t('members.house_level'))}
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">
                {t('members.troop_type')}
              </th>
              {showOnline && (
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span>{t('members.online')}</span>
                    {canEdit && (
                      <button
                        onClick={() => setResetConfirm(true)}
                        title={t('members.online_reset')}
                        className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </th>
              )}
              <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">
                {t('members.note')}
              </th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">
                {t('members.col_actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {members.map((m, i) => {
              const isMine = m.id === myMemberId
              return (
              <tr
                key={m.id}
                className={`transition-colors group ${
                  isMine
                    ? 'bg-[var(--color-brand)]/10 hover:bg-[var(--color-brand)]/15'
                    : 'hover:bg-[var(--color-bg-surface)]'
                }`}
              >
                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-[var(--color-text-muted)] text-xs">{i + 1}</td>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium text-[var(--color-text-primary)]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="whitespace-nowrap">{m.inGameName}</span>
                    {isMine && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)] text-white leading-none">
                        {t('members.my_row_badge')}
                      </span>
                    )}
                  </div>
                  {/* 모바일에서 메모 표시 (md 이상에선 별도 컬럼으로 보이므로 숨김) */}
                  {m.note && (
                    <p className="md:hidden mt-1 text-xs text-[var(--color-text-secondary)] break-all line-clamp-2">
                      <span className="text-[var(--color-text-muted)] mr-1">{t('members.note')}:</span>
                      {m.note}
                    </p>
                  )}
                </td>
                {showUid && <td className="hidden md:table-cell px-4 py-3 text-[var(--color-text-secondary)]">{m.zaloName || '-'}</td>}
                <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                  {m.cp ? <Badge variant="success">{m.cp}</Badge> : <span className="text-[var(--color-text-muted)]">-</span>}
                </td>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                  {m.houseLevel ? <Badge variant="default">{m.houseLevel}</Badge> : <span className="text-[var(--color-text-muted)]">-</span>}
                </td>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap">
                  {m.troopType ? <Badge variant="default">{t(`members.troop_${m.troopType}`)}</Badge> : <span className="text-[var(--color-text-muted)]">-</span>}
                </td>
                {showOnline && (
                <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap">
                  {canEditRow(m) ? (
                    <select
                      value={m.onlineStatus}
                      onChange={(e) => setOnlineStatus(m.id, e.target.value as OnlineStatus)}
                      className={`text-xs rounded-md border px-1.5 py-1 outline-none focus:border-[var(--color-brand)] cursor-pointer ${
                        m.onlineStatus === 'yes'
                          ? 'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30'
                          : m.onlineStatus === 'no'
                            ? 'bg-[var(--color-danger)]/15 text-[var(--color-danger)] border-[var(--color-danger)]/30'
                            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]'
                      }`}
                    >
                      {ONLINE_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]">
                          {t(`members.online_${s}`)}
                        </option>
                      ))}
                    </select>
                  ) : m.onlineStatus === 'yes' ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-success)]/15 text-[var(--color-success)]">{t('members.online_yes')}</span>
                  ) : m.onlineStatus === 'no' ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-danger)]/15 text-[var(--color-danger)]">{t('members.online_no')}</span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">-</span>
                  )}
                </td>
                )}
                <td className="hidden md:table-cell px-4 py-3 text-[var(--color-text-muted)] text-xs max-w-[150px] truncate">
                  {m.note || '-'}
                </td>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                  {canEditRow(m) && (
                    // 본인 행은 항상 노출 (발견율 ↑), 관리자가 다른 멤버 행 편집할 땐 hover 시 노출
                    <div className={`flex gap-1 transition-opacity ${
                      isMine ? 'opacity-100' : 'sm:opacity-0 sm:group-hover:opacity-100'
                    }`}>
                      <button
                        onClick={() => openEdit(m)}
                        title={isMine ? t('members.edit_my_info') : undefined}
                        className={`p-1.5 rounded transition-colors ${
                          isMine
                            ? 'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand)]/90 ring-2 ring-[var(--color-brand)]/40'
                            : 'hover:bg-[var(--color-bg-elevated)] text-(--color-brand) hover:brightness-125'
                        }`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {canEdit && (
                        <button onClick={() => setDeleteConfirm(m)} className="p-1.5 rounded hover:bg-[var(--color-bg-elevated)] text-(--color-danger) hover:brightness-125">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold">
                {editId ? t('members.edit_title') : t('members.add_title')}
              </h2>
              <button onClick={closeForm} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { key: 'inGameName', label: t('members.in_game_name') + ' *', placeholder: t('members.in_game_placeholder') },
                { key: 'zaloName', label: t('members.zalo_name'), placeholder: t('members.zalo_placeholder') },
                { key: 'cp', label: t('members.cp'), placeholder: t('members.cp_placeholder') },
                { key: 'houseLevel', label: t('members.house_level'), placeholder: t('members.level_placeholder') },
                { key: 'note', label: t('members.note'), placeholder: t('members.note_placeholder') },
              ].map(({ key, label, placeholder }) => {
                const isNameField = key === 'inGameName'
                const disabled = isNameField && !canEdit
                return (
                  <div key={key}>
                    <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{label}</label>
                    <Input
                      value={(form as Record<string, string>)[key] ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      disabled={disabled}
                      className={disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    />
                    {/* 인게임명 변경 시 로그인 계정도 함께 바뀐다는 안내 */}
                    {isNameField && editId && canEdit && (
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-1 break-keep">
                        {t('members.rename_sync_hint')}
                      </p>
                    )}
                  </div>
                )
              })}

              {/* 병종 선택 (파이터/슈터/라이더) */}
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('members.troop_type')}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['', ...TROOP_TYPES] as const).map((tp) => {
                    const active = (form.troopType ?? '') === tp
                    return (
                      <button
                        key={tp || 'none'}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, troopType: tp }))}
                        className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          active
                            ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                            : 'border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                        }`}
                      >
                        {tp ? t(`members.troop_${tp}`) : t('members.troop_none')}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Online (주말 이벤트 참여) 선택 — 컬럼 표시 중일 때만 */}
              {showOnline && (
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('members.online')}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ONLINE_STATUSES.map((s) => {
                    const active = (form.onlineStatus ?? 'none') === s
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, onlineStatus: s }))}
                        className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          active
                            ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                            : 'border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                        }`}
                      >
                        {t(`members.online_${s}`)}
                      </button>
                    )
                  })}
                </div>
              </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" size="full" onClick={closeForm}>{t('common.cancel')}</Button>
              <Button size="full" onClick={handleSave} disabled={!form.inGameName?.trim() || saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editId ? t('common.save') : t('common.add')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Online 전체 초기화 확인 */}
      {resetConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-[var(--color-danger)]" />
              </div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('members.online_reset_title')}</h2>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5 leading-relaxed break-keep">{t('members.online_reset_desc')}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="full" onClick={() => setResetConfirm(false)} disabled={resetting}>{t('common.cancel')}</Button>
              <Button
                size="full"
                className="bg-[var(--color-danger)] hover:bg-red-700 text-white"
                onClick={async () => { setResetting(true); try { await resetAllOnline() } finally { setResetting(false); setResetConfirm(false) } }}
                disabled={resetting}
              >
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {t('members.online_reset')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('members.delete_title')}</h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5 truncate">{deleteConfirm.inGameName}</p>
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-3 leading-relaxed break-keep">
              {t('members.delete_desc')}
            </p>
            <div className="mb-5 flex items-start gap-2 p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30">
              <AlertTriangle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-danger)] leading-relaxed break-keep flex-1">
                {t('members.delete_cascade_warning')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="full" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
                {t('common.cancel')}
              </Button>
              <Button
                size="full"
                className="bg-[var(--color-danger)] hover:bg-red-700 text-white"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
