/** 이주 신청 시즌. 신청·등급·단체는 모두 한 시즌에 귀속된다. */
export interface TransferSeason {
  id: string
  name: string
  /** 신청을 받는 시즌. DB partial unique index 로 동시에 하나만 존재한다 */
  isActive: boolean
  openedAt: string
  closedAt: string | null
  sortOrder: number
  createdAt: string
}
