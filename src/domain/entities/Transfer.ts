export type TransferStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface TransferApplication {
  id: string
  inGameName: string
  uid: string
  currentServer: string
  country: string
  cp: string
  tierId: string | null
  status: TransferStatus
  adminMessage: string
  reviewedAt: string | null
  reviewedBy: string | null
  createdAt: string
}

export interface TransferDraft {
  inGameName: string
  uid: string
  currentServer: string
  country: string
  cp: string
  tierId: string | null
}
