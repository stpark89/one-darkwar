export interface Member {
  id: string
  inGameName: string
  zaloName: string
  cp: string        // 전투력 (예: "3.54G")
  houseLevel: string
  note: string
}

export interface CreateMemberInput {
  inGameName: string
  zaloName?: string
  cp?: string
  houseLevel?: string
  note?: string
}
