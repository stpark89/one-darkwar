/** 병종 — 파이터/슈터/라이더 (빈 문자열 = 미지정) */
export type TroopType = '' | 'fighter' | 'shooter' | 'rider'
export const TROOP_TYPES = ['fighter', 'shooter', 'rider'] as const

export interface Member {
  id: string
  inGameName: string
  zaloName: string
  cp: string        // 전투력 (예: "3.54G")
  houseLevel: string
  troopType: TroopType
  note: string
}

export interface CreateMemberInput {
  inGameName: string
  zaloName?: string
  cp?: string
  houseLevel?: string
  troopType?: TroopType
  note?: string
}
