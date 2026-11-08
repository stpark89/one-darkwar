export type Facility = 'armory' | 'castle'

export interface OccupationTurn {
  id: string
  facility: Facility
  allianceName: string
  sortOrder: number
  isCurrent: boolean
  note: string
  /** 주차 날짜 YYYY-MM-DD — 같은 주차 행은 같은 값 */
  weekDate: string | null
  createdAt: string
}

export interface OccupationTurnDraft {
  facility: Facility
  allianceName: string
  sortOrder: number
  isCurrent: boolean
  note: string
  weekDate?: string | null
}
