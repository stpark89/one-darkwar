export type Facility = 'armory' | 'castle'

export interface OccupationTurn {
  id: string
  facility: Facility
  allianceName: string
  sortOrder: number
  isCurrent: boolean
  note: string
  createdAt: string
}

export interface OccupationTurnDraft {
  facility: Facility
  allianceName: string
  sortOrder: number
  isCurrent: boolean
  note: string
}
