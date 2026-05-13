export type WarTeam = 'A' | 'B' | ''
export type WarRole = 'CT' | 'DB' | ''   // CT=지휘관, DB=예비

export interface WarRoundEntry {
  team: WarTeam
  role: WarRole
  note: string
}

export interface WarParticipant {
  id: string
  inGameName: string
  cp: string
  zaloName: string
  round1: WarRoundEntry
  round2: WarRoundEntry
  round3: WarRoundEntry
  round4: WarRoundEntry
}

export interface WarSession {
  id: string
  name: string          // 예: "BLACK GOLD"
  rounds: { label: string; date: string }[]
  participants: WarParticipant[]
}
