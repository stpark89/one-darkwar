/** 병종 — 파이터/슈터/라이더 (빈 문자열 = 미지정) */
export type TroopType = '' | 'fighter' | 'shooter' | 'rider'
export const TROOP_TYPES = ['fighter', 'shooter', 'rider'] as const

/** 주말 이벤트 참여 여부(Online) — none(기본) / yes / no */
export type OnlineStatus = 'none' | 'yes' | 'no'
export const ONLINE_STATUSES = ['none', 'yes', 'no'] as const

export interface Member {
  id: string
  inGameName: string
  zaloName: string
  cp: string        // 전투력 (예: "3.54G")
  houseLevel: string
  troopType: TroopType
  onlineStatus: OnlineStatus
  note: string
  role: 'ROLE_ADMIN' | 'ROLE_USER' | ''
}

export interface CreateMemberInput {
  inGameName: string
  zaloName?: string
  cp?: string
  houseLevel?: string
  troopType?: TroopType
  onlineStatus?: OnlineStatus
  note?: string
}
