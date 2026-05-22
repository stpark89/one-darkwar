export type WarTeam = 'A' | 'B' | ''
export type WarRole = 'CT' | 'DB' | ''

export interface Season {
  id: string
  name: string
  isActive: boolean
}

export interface WarRound {
  id: string
  seasonId: string
  sortOrder: number
  date: string
}

export interface WarEntry {
  roundId: string
  memberId: string
  team: WarTeam
  role: WarRole
  note: string
}

export interface VsPointEntry {
  roundId: string
  memberId: string
  points: number
}

export interface MemberWarRow {
  memberId: string
  inGameName: string
  entryMap: Record<string, { team: WarTeam; role: WarRole; note: string }>
  total: number
}
