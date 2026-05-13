import * as XLSX from 'xlsx'
import type { Member } from '@/domain/entities/Member'
import type { WarParticipant } from '@/domain/entities/War'
import type { EventSession, EventAttendance } from '@/domain/entities/Event'

export function exportMembersToExcel(members: Member[]) {
  const ws = XLSX.utils.json_to_sheet(members.map((m, i) => ({
    'STT': i + 1,
    'TÊN INGAME': m.inGameName,
    'TÊN ZALO': m.zaloName,
    'LỰC CHIẾN': m.cp,
    'LEVEL NHÀ': m.houseLevel,
    'GHI CHÚ': m.note,
  })))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'MEMBERS')
  XLSX.writeFile(wb, 'one-darkwar-members.xlsx')
}

export function exportWarToExcel(participants: WarParticipant[]) {
  const rows = participants.map((p, i) => ({
    'STT': i + 1,
    'TÊN INGAME': p.inGameName,
    'CP': p.cp,
    'TÊN ZALO': p.zaloName,
    'Đợt 1: Team': p.round1.team,
    'Đợt 1: Vai trò': p.round1.role,
    'Ghi chú 1': p.round1.note,
    'Đợt 2: Team': p.round2.team,
    'Đợt 2: Vai trò': p.round2.role,
    'Ghi chú 2': p.round2.note,
    'Đợt 3: Team': p.round3.team,
    'Đợt 3: Vai trò': p.round3.role,
    'Ghi chú 3': p.round3.note,
    'Đợt 4: Team': p.round4.team,
    'Đợt 4: Vai trò': p.round4.role,
    'Ghi chú 4': p.round4.note,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'BLACK GOLD')
  XLSX.writeFile(wb, 'one-darkwar-war.xlsx')
}

export function exportEventsToExcel(events: EventSession[], attendance: EventAttendance[]) {
  const header = ['STT', 'TÊN INGAME', ...events.map((e) => e.name)]
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

export async function importFromExcel(file: File): Promise<{
  members?: Member[]
  warParticipants?: WarParticipant[]
}> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const result: { members?: Member[]; warParticipants?: WarParticipant[] } = {}

  // 멤버 시트
  const memberSheet = wb.Sheets['MEMBERS'] ?? wb.Sheets[wb.SheetNames[0]]
  if (memberSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(memberSheet)
    result.members = rows.map((r, i) => ({
      id: String(i + 1),
      inGameName: r['TÊN INGAME'] ?? '',
      zaloName: r['TÊN ZALO'] ?? '',
      cp: r['LỰC CHIẾN'] ?? '',
      houseLevel: r['LEVEL NHÀ'] ?? '',
      note: r['GHI CHÚ'] ?? '',
    }))
  }

  return result
}
