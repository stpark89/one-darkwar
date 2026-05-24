export interface TransferTier {
  id: string
  name: string
  minCp: number          // M 단위
  maxCp: number | null   // null = 상한 없음
  capacity: number
  sortOrder: number
  seasonName: string
  createdAt: string
}

export interface TransferTierDraft {
  name: string
  minCp: number
  maxCp: number | null
  capacity: number
  sortOrder: number
  seasonName: string
}
