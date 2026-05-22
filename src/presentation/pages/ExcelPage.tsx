import { useRef, useState } from 'react'
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemberStore } from '@/infrastructure/stores/memberStore'
import { useWarStore } from '@/infrastructure/stores/warStore'
import { useEventStore } from '@/infrastructure/stores/eventStore'
import {
  exportMembersToExcel, exportWarToExcel, exportEventsToExcel,
  downloadMemberSample, downloadWarSample, downloadEventSample,
  parseImportPreview,
  type ImportPreview, type MemberChange, type EntryChange,
} from '@/application/services/excelService'
import type { WarTeam, WarRole } from '@/domain/entities/War'
import type { AttendanceStatus } from '@/domain/entities/Event'
import { cn } from '@/lib/utils'

type ImportState =
  | { step: 'idle' }
  | { step: 'parsing' }
  | { step: 'error'; message: string }
  | { step: 'preview'; preview: ImportPreview }
  | { step: 'applying' }
  | { step: 'done'; message: string }

const STATUS_STYLE = {
  new:     'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  changed: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
  removed: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
}

export const ExcelPage = () => {
  const { t } = useTranslation()
  const { members, addMember, updateMember } = useMemberStore()
  const { getMemberRows, rounds, entries, batchSave: batchSaveWar } = useWarStore()
  const { events, attendance, updateStatus } = useEventStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [importState, setImportState] = useState<ImportState>({ step: 'idle' })

  const handleFile = async (file: File) => {
    setImportState({ step: 'parsing' })
    const result = await parseImportPreview(file, {
      members,
      war: { rounds, entries },
      events: { events, attendance },
    })
    if (!result.ok) {
      setImportState({ step: 'error', message: result.error })
    } else {
      setImportState({ step: 'preview', preview: result.preview })
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleApply = async () => {
    if (importState.step !== 'preview') return
    const { preview } = importState
    setImportState({ step: 'applying' })

    if (preview.type === 'members') {
      for (const c of preview.changes) {
        if (c.status === 'new') {
          await addMember({ inGameName: c.inGameName, zaloName: c.raw.uid, cp: c.raw.cp, houseLevel: c.raw.house, note: c.raw.note })
        } else if (c.existingId) {
          await updateMember(c.existingId, { zaloName: c.raw.uid, cp: c.raw.cp, houseLevel: c.raw.house, note: c.raw.note })
        }
      }
    } else if (preview.type === 'war') {
      const warChanges = preview.changes
        .filter(c => c.memberId && c.roundId)
        .map(c => {
          const [team, role] = c.to.split('·')
          return { roundId: c.roundId!, memberId: c.memberId!, team: (team ?? '') as WarTeam, role: (role ?? '') as WarRole, note: '' }
        })
      await batchSaveWar(warChanges)
    } else if (preview.type === 'events') {
      for (const c of preview.changes) {
        if (!c.memberId || !c.eventId) continue
        await updateStatus(c.memberId, c.eventId, c.to as AttendanceStatus)
      }
    }

    setImportState({ step: 'done', message: t('excel.apply_success') })
  }

  const typeLabel = (type: ImportPreview['type']) => ({
    members: t('excel.preview_type_members'),
    war: t('excel.preview_type_war'),
    events: t('excel.preview_type_events'),
  })[type]

  const getSummary = (preview: ImportPreview) => {
    const counts = { new: 0, changed: 0, removed: 0 }
    preview.changes.forEach(c => counts[c.status]++)
    return counts
  }

  return (
    <div className="p-3 sm:p-6 max-w-3xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{t('excel.title')}</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{t('excel.subtitle')}</p>
      </div>

      {/* 내보내기 */}
      <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-subtle)] p-5 mb-4">
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Download className="w-4 h-4 text-[var(--color-brand)]" /> {t('excel.export_title')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: t('excel.export_members'), desc: `${members.length}${t('common.count_people')}`,
              onClick: () => exportMembersToExcel(members, {
                no: t('excel.col_no'), name: t('excel.col_name'), uid: t('excel.col_uid'),
                cp: t('excel.col_cp'), house: t('excel.col_house'), note: t('excel.col_note'),
              }),
              color: 'text-[var(--color-success)]',
            },
            {
              label: t('excel.export_war'), desc: `${rounds.length}${t('excel.col_round_count')}`,
              onClick: () => exportWarToExcel(getMemberRows(), rounds, {
                no: t('excel.col_no'), name: t('excel.col_name'), total: t('excel.col_total'),
                round: (n, date) => t('excel.col_round', { n, date }),
              }),
              color: 'text-[var(--color-warning)]',
            },
            {
              label: t('excel.export_events'), desc: `${events.length}${t('excel.col_event_count')}`,
              onClick: () => exportEventsToExcel(events, attendance, {
                no: t('excel.col_no'), name: t('excel.col_name'),
              }),
              color: 'text-[var(--color-brand)]',
            },
          ].map(({ label, desc, onClick, color }) => (
            <button
              key={label}
              onClick={onClick}
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-border)] transition-colors border border-[var(--color-border-subtle)] group"
            >
              <FileSpreadsheet className={cn('w-8 h-8', color)} />
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 가져오기 */}
      <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-subtle)] p-5">
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-[var(--color-brand)]" /> {t('excel.import_title')}
        </h2>

        {/* 샘플 양식 다운로드 */}
        {importState.step === 'idle' && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">{t('excel.sample_title')}</p>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: t('excel.preview_type_members'),
                  onClick: () => downloadMemberSample(
                    { no: t('excel.col_no'), name: t('excel.col_name'), uid: t('excel.col_uid'), cp: t('excel.col_cp'), house: t('excel.col_house'), note: t('excel.col_note') },
                    t('excel.sample_label'),
                  ),
                },
                {
                  label: t('excel.preview_type_war'),
                  onClick: () => downloadWarSample(
                    rounds,
                    { no: t('excel.col_no'), name: t('excel.col_name'), total: t('excel.col_total'), round: (n, date) => t('excel.col_round', { n, date }) },
                    t('excel.sample_label'),
                  ),
                },
                {
                  label: t('excel.preview_type_events'),
                  onClick: () => downloadEventSample(
                    events,
                    { no: t('excel.col_no'), name: t('excel.col_name') },
                    t('excel.sample_label'),
                  ),
                },
              ].map(({ label, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors"
                >
                  <Download className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-2">{t('excel.sample_hint')}</p>
          </div>
        )}

        {/* 드래그 앤 드롭 영역 */}
        {importState.step !== 'preview' && importState.step !== 'applying' && importState.step !== 'done' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              dragging ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5' : 'border-[var(--color-border)] hover:border-[var(--color-brand)]/50',
            )}
          >
            {importState.step === 'parsing' ? (
              <div className="flex flex-col items-center gap-2 text-[var(--color-text-muted)]">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">{t('excel.parsing')}</p>
              </div>
            ) : (
              <>
                <FileSpreadsheet className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t('excel.drag_drop')}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('excel.file_types')}</p>
              </>
            )}
          </div>
        )}

        <input
          ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />

        {/* 에러 */}
        {importState.step === 'error' && (
          <div className="mt-3 p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--color-danger)]">{importState.message}</p>
          </div>
        )}

        {/* 완료 */}
        {importState.step === 'done' && (
          <div className="mt-3 space-y-3">
            <div className="p-3 rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] flex-shrink-0" />
              <p className="text-sm text-[var(--color-success)]">{importState.message}</p>
            </div>
            <button
              onClick={() => setImportState({ step: 'idle' })}
              className="w-full py-2 rounded-lg border border-[var(--color-border-subtle)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
            >
              {t('excel.upload_new')}
            </button>
          </div>
        )}

        {/* 미리보기 */}
        {importState.step === 'preview' && (() => {
          const { preview } = importState
          const counts = getSummary(preview)
          const hasChanges = counts.new + counts.changed + counts.removed > 0

          return (
            <div className="space-y-4">
              {/* 헤더 */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
                    {typeLabel(preview.type)}
                  </span>
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {t('excel.preview_summary', { new: counts.new, changed: counts.changed, removed: counts.removed })}
                  </span>
                </div>
                <button
                  onClick={() => setImportState({ step: 'idle' })}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  {t('excel.preview_cancel')}
                </button>
              </div>

              {/* 변경 없음 */}
              {!hasChanges && (
                <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                  {t('excel.preview_no_changes')}
                </div>
              )}

              {/* 멤버 테이블 */}
              {hasChanges && preview.type === 'members' && (
                <MembersPreviewTable changes={preview.changes} t={t} />
              )}

              {/* 전쟁/이벤트 테이블 */}
              {hasChanges && (preview.type === 'war' || preview.type === 'events') && (
                <EntriesPreviewTable changes={preview.changes} type={preview.type} t={t} />
              )}

              {/* 미등록 멤버 경고 */}
              {hasChanges && preview.type !== 'members' && preview.changes.some(c => !c.memberId) && (
                <p className="text-xs text-[var(--color-warning)] flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {t('excel.unknown_member_warning')}
                </p>
              )}

              {/* 적용 버튼 */}
              {hasChanges && (
                <button
                  onClick={handleApply}
                  className="w-full py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  {t('excel.preview_apply')}
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {!hasChanges && (
                <button
                  onClick={() => setImportState({ step: 'idle' })}
                  className="w-full py-2 rounded-lg border border-[var(--color-border-subtle)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                >
                  {t('excel.preview_cancel')}
                </button>
              )}
            </div>
          )
        })()}

        {/* 적용 중 */}
        {importState.step === 'applying' && (
          <div className="py-10 flex flex-col items-center gap-3 text-[var(--color-text-muted)]">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">{t('excel.applying')}</p>
          </div>
        )}

        {/* 형식 안내 */}
        {importState.step === 'idle' && (
          <div className="mt-4 p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] space-y-2">
            <p className="text-xs font-semibold text-[var(--color-text-muted)]">{t('excel.format_hint_title')}</p>
            <div className="space-y-1 text-[11px] text-[var(--color-text-muted)]">
              <p>• <span className="font-semibold text-[var(--color-text-secondary)]">{t('excel.preview_type_members')}</span>: {t('excel.col_name')}, {t('excel.col_uid')}, {t('excel.col_cp')}, {t('excel.col_house')}, {t('excel.col_note')}</p>
              <p>• <span className="font-semibold text-[var(--color-text-secondary)]">{t('excel.preview_type_war')}</span>: {t('excel.col_name')}, {t('excel.col_round_label')} → <code className="bg-[var(--color-bg-surface)] px-1 rounded">A·CT</code> / <code className="bg-[var(--color-bg-surface)] px-1 rounded">B·DB</code></p>
              <p>• <span className="font-semibold text-[var(--color-text-secondary)]">{t('excel.preview_type_events')}</span>: {t('excel.col_name')}, {t('excel.col_event_label')} → <code className="bg-[var(--color-bg-surface)] px-1 rounded">CT</code> / <code className="bg-[var(--color-bg-surface)] px-1 rounded">DB</code></p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Preview sub-components ────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: MemberChange['status'] | EntryChange['status']; t: (k: string) => string }) {
  const label = { new: t('excel.preview_status_new'), changed: t('excel.preview_status_changed'), removed: t('excel.preview_status_removed') }[status]
  return (
    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap', STATUS_STYLE[status])}>
      {label}
    </span>
  )
}

function MembersPreviewTable({ changes, t }: { changes: MemberChange[]; t: (k: string, o?: Record<string, unknown>) => string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-hidden max-h-72 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="bg-[var(--color-bg-elevated)] sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left text-[var(--color-text-muted)] font-semibold w-16">{t('excel.preview_status_label')}</th>
            <th className="px-3 py-2 text-left text-[var(--color-text-muted)] font-semibold">{t('excel.col_name')}</th>
            <th className="px-3 py-2 text-left text-[var(--color-text-muted)] font-semibold">{t('excel.col_change_items')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-subtle)]">
          {changes.map((c) => (
            <tr key={c.inGameName} className="hover:bg-[var(--color-bg-elevated)]/50">
              <td className="px-3 py-2"><StatusBadge status={c.status} t={t} /></td>
              <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">{c.inGameName}</td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">
                {c.status === 'new'
                  ? [c.raw.uid && `UID: ${c.raw.uid}`, c.raw.cp && `CP: ${c.raw.cp}`, c.raw.house && `Lv: ${c.raw.house}`].filter(Boolean).join(' · ')
                  : c.fieldChanges.map(f => `${f.field.toUpperCase()}: ${f.from || '—'} → ${f.to || '—'}`).join(' · ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EntriesPreviewTable({ changes, type, t }: { changes: EntryChange[]; type: 'war' | 'events'; t: (k: string) => string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-hidden max-h-72 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="bg-[var(--color-bg-elevated)] sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left text-[var(--color-text-muted)] font-semibold w-16">{t('excel.preview_status_label')}</th>
            <th className="px-3 py-2 text-left text-[var(--color-text-muted)] font-semibold">{t('excel.col_name')}</th>
            <th className="px-3 py-2 text-left text-[var(--color-text-muted)] font-semibold">
              {type === 'war' ? t('excel.col_round_label') : t('excel.col_event_label')}
            </th>
            <th className="px-3 py-2 text-left text-[var(--color-text-muted)] font-semibold">{t('excel.col_before')}</th>
            <th className="px-3 py-2 text-left text-[var(--color-text-muted)] font-semibold">{t('excel.col_after')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-subtle)]">
          {changes.map((c, i) => (
            <tr key={i} className={cn('hover:bg-[var(--color-bg-elevated)]/50', !c.memberId && 'opacity-50')}>
              <td className="px-3 py-2"><StatusBadge status={c.status} t={t} /></td>
              <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">
                {c.memberName}
                {!c.memberId && <span className="ml-1 text-[var(--color-warning)]">⚠️</span>}
              </td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">{c.label}</td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">{c.from || '—'}</td>
              <td className="px-3 py-2 font-semibold text-[var(--color-text-primary)]">{c.to || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
