import * as XLSX from 'xlsx'
import type { Member } from '@/domain/entities/Member'
import type { MemberWarRow, WarRound, WarEntry } from '@/domain/entities/War'
import type { EventSession, EventAttendance } from '@/domain/entities/Event'

// ─── Export header types ───────────────────────────────────────────────────

export interface MemberExcelHeaders {
  no: string; name: string; uid: string; cp: string; house: string; note: string
}

export interface WarExcelHeaders {
  no: string; name: string; total: string; round: (n: number, date: string) => string
}

export interface EventExcelHeaders {
  no: string; name: string
}

// ─── Export functions ──────────────────────────────────────────────────────

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

// ─── Import preview types ──────────────────────────────────────────────────

export interface MemberChange {
  status: 'new' | 'changed'
  inGameName: string
  existingId?: string
  fieldChanges: { field: string; from: string; to: string }[]
  raw: { uid: string; cp: string; house: string; note: string }
}

export interface EntryChange {
  status: 'new' | 'changed' | 'removed'
  memberName: string
  memberId: string | null
  label: string
  roundId?: string
  eventId?: string
  from: string
  to: string
}

export type ImportPreview =
  | { type: 'members'; changes: MemberChange[] }
  | { type: 'war'; changes: EntryChange[] }
  | { type: 'events'; changes: EntryChange[] }

export type ParseResult =
  | { ok: true; preview: ImportPreview }
  | { ok: false; error: string }

// ─── Column detection helpers ──────────────────────────────────────────────

const NAME_ALIASES   = ['인게임명', 'In-Game Name', 'TÊN INGAME', '遊戲名稱']
const UID_ALIASES    = ['UID', 'TÊN ZALO']
const CP_ALIASES     = ['전투력', 'CP', 'LỰC CHIẾN', '戰鬥力']
const HOUSE_ALIASES  = ['집 레벨', 'House Level', 'LEVEL NHÀ', '房屋等級']
const NOTE_ALIASES   = ['메모', 'Note', 'GHI CHÚ', '備註']
const TOTAL_ALIASES  = ['합계', 'Total', 'TỔNG', '合計']
const SKIP_COLS      = new Set(['#', 'STT', ...TOTAL_ALIASES])

function findCol(keys: string[], aliases: string[]): string | undefined {
  return keys.find(k => aliases.includes(k))
}

function extractRoundNumber(col: string): number | null {
  for (const p of [/^(\d+)차/, /^Round\s+(\d+)/i, /^Đợt\s+(\d+)/i, /^第\s*(\d+)\s*回/]) {
    const m = col.match(p)
    if (m) return parseInt(m[1])
  }
  return null
}

// ─── Sheet parsers ─────────────────────────────────────────────────────────

function parseMembersSheet(ws: XLSX.WorkSheet, existing: Member[]): MemberChange[] | string {
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
  if (!rows.length) return '데이터가 없습니다.'

  const keys = Object.keys(rows[0])
  const nameCol = findCol(keys, NAME_ALIASES)
  if (!nameCol) return `인게임명 컬럼을 찾을 수 없습니다. (${NAME_ALIASES.join(', ')} 중 하나여야 합니다.)`

  const uidCol   = findCol(keys, UID_ALIASES)
  const cpCol    = findCol(keys, CP_ALIASES)
  const houseCol = findCol(keys, HOUSE_ALIASES)
  const noteCol  = findCol(keys, NOTE_ALIASES)

  const changes: MemberChange[] = []
  for (const row of rows) {
    const inGameName = String(row[nameCol] ?? '').trim()
    if (!inGameName) continue

    const raw = {
      uid:   String(row[uidCol   ?? ''] ?? '').trim(),
      cp:    String(row[cpCol    ?? ''] ?? '').trim(),
      house: String(row[houseCol ?? ''] ?? '').trim(),
      note:  String(row[noteCol  ?? ''] ?? '').trim(),
    }

    const found = existing.find(m => m.inGameName === inGameName)
    if (!found) {
      changes.push({ status: 'new', inGameName, fieldChanges: [], raw })
    } else {
      const fieldChanges: MemberChange['fieldChanges'] = []
      if (uidCol   && raw.uid   !== found.zaloName)   fieldChanges.push({ field: 'uid',   from: found.zaloName,   to: raw.uid })
      if (cpCol    && raw.cp    !== found.cp)          fieldChanges.push({ field: 'cp',    from: found.cp,         to: raw.cp })
      if (houseCol && raw.house !== found.houseLevel)  fieldChanges.push({ field: 'house', from: found.houseLevel, to: raw.house })
      if (noteCol  && raw.note  !== found.note)        fieldChanges.push({ field: 'note',  from: found.note,       to: raw.note })
      if (fieldChanges.length > 0) {
        changes.push({ status: 'changed', inGameName, existingId: found.id, fieldChanges, raw })
      }
    }
  }
  return changes
}

function parseWarSheet(
  ws: XLSX.WorkSheet,
  rounds: WarRound[],
  entries: WarEntry[],
  members: Member[],
): EntryChange[] | string {
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
  if (!rows.length) return '데이터가 없습니다.'

  const keys = Object.keys(rows[0])
  const nameCol = findCol(keys, NAME_ALIASES)
  if (!nameCol) return '인게임명 컬럼을 찾을 수 없습니다.'

  const roundCols: { col: string; roundId: string }[] = []
  for (const col of keys) {
    if (SKIP_COLS.has(col) || col === nameCol) continue
    const n = extractRoundNumber(col)
    if (n !== null) {
      const round = rounds.find(r => r.sortOrder === n)
      if (round) roundCols.push({ col, roundId: round.id })
    }
  }
  if (!roundCols.length) return '인식 가능한 회차 컬럼이 없습니다. (예: 1차, Round 1, Đợt 1)'

  const changes: EntryChange[] = []
  for (const row of rows) {
    const memberName = String(row[nameCol] ?? '').trim()
    if (!memberName) continue
    const member = members.find(m => m.inGameName === memberName)

    for (const { col, roundId } of roundCols) {
      const cellVal = String(row[col] ?? '').trim()
      const match = cellVal.match(/^([AB])·(CT|DB)$/)
      const newStr = match ? cellVal : ''
      const existing = member ? entries.find(e => e.roundId === roundId && e.memberId === member.id) : null
      const existingStr = existing ? `${existing.team}·${existing.role}` : ''

      if (newStr !== existingStr) {
        changes.push({
          status: !existingStr ? 'new' : !newStr ? 'removed' : 'changed',
          memberName, memberId: member?.id ?? null, label: col, roundId,
          from: existingStr, to: newStr,
        })
      }
    }
  }
  return changes
}

function parseEventsSheet(
  ws: XLSX.WorkSheet,
  events: EventSession[],
  attendance: EventAttendance[],
  members: Member[],
): EntryChange[] | string {
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
  if (!rows.length) return '데이터가 없습니다.'

  const keys = Object.keys(rows[0])
  const nameCol = findCol(keys, NAME_ALIASES)
  if (!nameCol) return '인게임명 컬럼을 찾을 수 없습니다.'

  const eventCols: { col: string; eventId: string; eventName: string }[] = []
  for (const col of keys) {
    if (SKIP_COLS.has(col) || col === nameCol) continue
    const event = events.find(e => e.name === col)
    if (event) eventCols.push({ col, eventId: event.id, eventName: event.name })
  }
  if (!eventCols.length) return '인식 가능한 이벤트 컬럼이 없습니다. (이벤트 이름과 컬럼명이 일치해야 합니다.)'

  const changes: EntryChange[] = []
  for (const row of rows) {
    const memberName = String(row[nameCol] ?? '').trim()
    if (!memberName) continue
    const member = members.find(m => m.inGameName === memberName)

    for (const { col, eventId, eventName } of eventCols) {
      const cellVal = String(row[col] ?? '').trim().toUpperCase()
      const newStatus = ['CT', 'DB'].includes(cellVal) ? cellVal : ''
      const attRec = member ? attendance.find(a => a.memberId === member.id) : null
      const existingStatus = String(attRec?.records[eventId] ?? '')

      if (newStatus !== existingStatus) {
        changes.push({
          status: !existingStatus ? 'new' : !newStatus ? 'removed' : 'changed',
          memberName, memberId: member?.id ?? null, label: eventName, eventId,
          from: existingStatus, to: newStatus,
        })
      }
    }
  }
  return changes
}

// ─── Main preview parser ───────────────────────────────────────────────────

export async function parseImportPreview(
  file: File,
  existingData: {
    members: Member[]
    war: { rounds: WarRound[]; entries: WarEntry[] }
    events: { events: EventSession[]; attendance: EventAttendance[] }
  },
): Promise<ParseResult> {
  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    return { ok: false, error: '❌ .xlsx 또는 .xls 파일만 지원합니다.' }
  }

  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })

  if (wb.SheetNames.includes('MEMBERS')) {
    const r = parseMembersSheet(wb.Sheets['MEMBERS'], existingData.members)
    if (typeof r === 'string') return { ok: false, error: `❌ ${r}` }
    return { ok: true, preview: { type: 'members', changes: r } }
  }
  if (wb.SheetNames.includes('BLACK GOLD')) {
    const r = parseWarSheet(wb.Sheets['BLACK GOLD'], existingData.war.rounds, existingData.war.entries, existingData.members)
    if (typeof r === 'string') return { ok: false, error: `❌ ${r}` }
    return { ok: true, preview: { type: 'war', changes: r } }
  }
  if (wb.SheetNames.includes('EVENTS')) {
    const r = parseEventsSheet(wb.Sheets['EVENTS'], existingData.events.events, existingData.events.attendance, existingData.members)
    if (typeof r === 'string') return { ok: false, error: `❌ ${r}` }
    return { ok: true, preview: { type: 'events', changes: r } }
  }

  return { ok: false, error: '⚠️ 인식할 수 없는 시트입니다. (MEMBERS, BLACK GOLD, EVENTS 시트 중 하나여야 합니다.)' }
}

// ─── Legacy import (kept for backward compat) ─────────────────────────────

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
