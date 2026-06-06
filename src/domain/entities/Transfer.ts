export type TransferStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/** 희망 동맹. OTHER 면 desiredAllianceOther 에 자유 입력값 */
export type DesiredAlliance = 'ONE' | 'NXO' | 'NH_D' | 'OTHER'

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
  /** 그룹(단체) 신청이면 그룹 id. 단독 신청은 null */
  groupId: string | null
  desiredAlliance: DesiredAlliance
  desiredAllianceOther: string
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
  desiredAlliance: DesiredAlliance
  desiredAllianceOther: string
}

/** 그룹(단체) 신청 */
export interface ApplicationGroup {
  id: string
  leaderName: string
  leaderUid: string
  leaderContact: string
  desiredAlliance: DesiredAlliance
  desiredAllianceOther: string
  memberCount: number
  createdAt: string
}

/** 그룹 신청 폼 입력 */
export interface GroupSubmitDraft {
  leaderName: string
  leaderUid: string
  leaderContact: string
  desiredAlliance: DesiredAlliance
  desiredAllianceOther: string
  members: Array<{
    inGameName: string
    uid: string
    currentServer: string
    country: string
    cp: string
    tierId: string | null
  }>
}
