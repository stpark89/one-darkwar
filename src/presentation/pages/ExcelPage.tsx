import { useRef, useState } from 'react'
import { Download, Upload, FileSpreadsheet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemberStore } from '@/infrastructure/stores/memberStore'
import { useWarStore } from '@/infrastructure/stores/warStore'
import { useEventStore } from '@/infrastructure/stores/eventStore'
import { exportMembersToExcel, exportWarToExcel, exportEventsToExcel, importFromExcel } from '@/application/services/excelService'
import { cn } from '@/lib/utils'

export const ExcelPage = () => {
  const { t } = useTranslation()
  const { members, setMembers } = useMemberStore()
  const { session } = useWarStore()
  const { events, attendance } = useEventStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const handleImport = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setImportResult(t('excel.import_invalid'))
      return
    }
    const result = await importFromExcel(file)
    if (result.members) {
      setMembers(result.members)
      setImportResult(t('excel.import_success', { count: result.members.length }))
    } else {
      setImportResult(t('excel.import_no_sheet'))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImport(file)
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{t('excel.title')}</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{t('excel.subtitle')}</p>
      </div>

      {/* 내보내기 */}
      <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-subtle)] p-5 mb-4">
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Download className="w-4 h-4 text-[var(--color-brand)]" /> {t('excel.export_title')}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('excel.export_members'), desc: `${members.length}${t('common.count_people')}`, onClick: () => exportMembersToExcel(members), color: 'text-[var(--color-success)]' },
            { label: t('excel.export_war'), desc: `${session.participants.length}${t('common.count_people')}`, onClick: () => exportWarToExcel(session.participants), color: 'text-[var(--color-warning)]' },
            { label: t('excel.export_events'), desc: `${events.length}`, onClick: () => exportEventsToExcel(events, attendance), color: 'text-[var(--color-brand)]' },
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
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors',
            dragging ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5' : 'border-[var(--color-border)] hover:border-[var(--color-brand)]/50',
          )}
        >
          <FileSpreadsheet className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t('excel.drag_drop')}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('excel.file_types')}</p>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f) }} />

        {importResult && (
          <div className={cn('mt-3 p-3 rounded-lg text-sm', importResult.startsWith('✅') ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]')}>
            {importResult}
          </div>
        )}

        <div className="mt-4 p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
          <p className="text-xs text-[var(--color-text-muted)] font-semibold mb-1">{t('excel.format_hint_title')}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{t('excel.format_hint_body')}</p>
        </div>
      </div>
    </div>
  )
}
