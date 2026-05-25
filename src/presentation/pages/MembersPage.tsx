import { useState, useEffect } from 'react'
import { Search, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemberStore } from '@/infrastructure/stores/memberStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { Badge } from '@/presentation/components/ui/badge'
import { SortIcon, nextSortDir } from '@/presentation/components/ui/sort-icon'
import type { SortDir } from '@/presentation/components/ui/sort-icon'
import type { Member } from '@/domain/entities/Member'

const EMPTY: Partial<Member> = { inGameName: '', zaloName: '', cp: '', houseLevel: '', note: '' }

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
  const { getFiltered, searchQuery, setSearchQuery, addMember, updateMember, deleteMember, loadMembers, loading } = useMemberStore()
  const { user } = useAuthStore()
  const canEdit = user?.role === 'ROLE_ADMIN'
  const canEditRow = (m: Member) => canEdit || m.inGameName === user?.inGameName
  const base = getFiltered()

  const [form, setForm] = useState<Partial<Member> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Member | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('cp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

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

  const members = [...base].sort((a, b) => {
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
    if (!form?.inGameName?.trim()) return
    if (editId) await updateMember(editId, form)
    else await addMember({ inGameName: form.inGameName!, ...form })
    closeForm()
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

      <div className="relative mb-3 sm:mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('members.search_placeholder')}
          className="pl-9"
        />
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
              <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">
                {t('members.zalo_name')}
              </th>
              {th('cp', t('members.cp'))}
              {th('houseLevel', t('members.house_level'))}
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
                <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium text-[var(--color-text-primary)] whitespace-nowrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{m.inGameName}</span>
                    {isMine && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)] text-white leading-none">
                        {t('members.my_row_badge')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="hidden sm:table-cell px-4 py-3 text-[var(--color-text-secondary)]">{m.zaloName || '-'}</td>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                  {m.cp ? <Badge variant="success">{m.cp}</Badge> : <span className="text-[var(--color-text-muted)]">-</span>}
                </td>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                  {m.houseLevel ? <Badge variant="default">{m.houseLevel}</Badge> : <span className="text-[var(--color-text-muted)]">-</span>}
                </td>
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
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" size="full" onClick={closeForm}>{t('common.cancel')}</Button>
              <Button size="full" onClick={handleSave} disabled={!form.inGameName?.trim()}>
                {editId ? t('common.save') : t('common.add')}
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
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">{t('members.delete_desc')}</p>
            <p className="text-xs text-[var(--color-danger)] mb-5 break-keep">{t('members.delete_cascade_warning')}</p>
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
