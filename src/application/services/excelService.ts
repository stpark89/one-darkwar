import * as XLSX from 'xlsx'
import type { Member } from '@/domain/entities/Member'
import type { MemberWarRow, WarRound } from '@/domain/entities/War'
import type { EventSession, EventAttendance } from '@/domain/entities/Event'

export interface MemberExcelHeaders {
  no: string; name: string; uid: string; cp: string; house: string; note: string
}

export interface WarExcelHeaders {
  no: string; name: string; total: string; round: (n: number, date: string) => string
}

export interface EventExcelHeaders {
  no: string; name: string
}

export function exportMembersToExcel(members: Member[], headers: MemberExcelHeaders) {
  const ws = XLSX.utils.json_to_sheet(members.map((m, i) => ({
    [headers.no]: i + 1,
    [headers.name]: m.inGameName,
    [headers.uid]: m.zaloName,
    [headers.cp]: m.cp,
    [headers.house]: m.houseLevel,
    [headers.note]: m.note,
  })))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'MEMBERS')
  XLSX.writeFile(wb, 'one-darkwar-members.xlsx')
}

export function exportWarToExcel(memberRows: MemberWarRow[], rounds: WarRound[], headers: WarExcelHeaders) {
  const rows = memberRows.map((m, i) => {
    const row: Record<string, string | number> = {
      [headers.no]: i + 1,
      [headers.name]: m.inGameName,
      [headers.total]: m.total,
    }
    rounds.forEach(r => {
      const e = m.entryMap[r.id] ?? { team: '', role: '' }
      row[headers.round(r.sortOrder, r.date)] = e.team && e.role ? `${e.team}·${e.role}` : ''
    })
    return row
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'BLACK GOLD')
  XLSX.writeFile(wb, 'one-darkwar-war.xlsx')
}

export function exportEventsToExcel(events: EventSession[], attendance: EventAttendance[], headers: EventExcelHeaders) {
  const header = [headers.no, headers.name, ...events.map((e) => e.name)]
  const rows = attendance.map((a, i) => [
    i + 1,
    a.inGameName,
    ...events.map((e) => a.records[e.eventKey] ?? ''),
  ])
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'EVENTS')
  XLSX.writeFile(wb, 'one-darkwar-events.xlsx')
}

export async function importFromExcel(file: File): Promise<{ members?: Member[] }> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const result: { members?: Member[] } = {}

  const memberSheet = wb.Sheets['MEMBERS'] ?? wb.Sheets[wb.SheetNames[0]]
  if (memberSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(memberSheet)
    result.members = rows.map((r, i) => ({
      id: String(i + 1),
      inGameName: r['TÊN INGAME'] ?? '',
      zaloName: r['TÊN ZALO'] ?? r['UID'] ?? '',
      cp: r['LỰC CHIẾN'] ?? '',
      houseLevel: r['LEVEL NHÀ'] ?? '',
      note: r['GHI CHÚ'] ?? '',
    }))
  }

  return result
}
