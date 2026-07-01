export type TransferStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/** 희망 동맹. OTHER 면 desiredAllianceOther 에 자유 입력값 */
export type DesiredAlliance = 'ONE' | 'NXO' | 'NH_D' | 'OTHER'

export interface TransferApplication {
  id: string
  inGameName: string
  uid: string
  currentServer: string
  country: string
  /** 부대 전투력 (1팀 최대 파워) — 참고용, 등급 산출에는 쓰지 않음 */
  cp: string
  /** 합산 전투력 (건물+과학기술+영웅+개조차) — 등급 매칭 기준 */
  totalPower: string
  /** 신청자가 직접 남기는 메모 (admin_message 와 별개) */
  note: string
  tierId: string | null
  status: TransferStatus
  adminMessage: string
  /** 그룹(단체) 신청이면 그룹 id. 단독 신청은 null */
  groupId: string | null
  /** 관리자가 배정한 그룹 id (admin_transfer_groups) */
  adminGroupId: string | null
  desiredAlliance: DesiredAlliance
  desiredAllianceOther: string
  reviewedAt: string | null
  reviewedBy: string | null
  createdAt: string
}

/** 관리자가 직접 생성하는 그룹 (승인된 신청자 조직용) */
export interface AdminTransferGroup {
  id: string
  name: string
  createdAt: string
}

export interface TransferDraft {
  inGameName: string
  uid: string
  currentServer: string
  country: string
  cp: string
  totalPower: string
  note: string
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
    totalPower: string
    note: string
    tierId: string | null
  }>
}
