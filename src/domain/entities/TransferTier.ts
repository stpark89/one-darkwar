/** 등급 색상 — 게임 티켓 색상과 매칭 */
export type TierColor = 'orange' | 'purple' | 'blue' | 'gray'

export interface TransferTier {
  id: string
  name: string
  minCp: number          // M 단위
  maxCp: number | null   // null = 상한 없음
  capacity: number
  sortOrder: number
  seasonName: string
  color: TierColor
  createdAt: string
}

export interface TransferTierDraft {
  name: string
  minCp: number
  maxCp: number | null
  capacity: number
  sortOrder: number
  seasonName: string
  color: TierColor
}

/** 색상 → Tailwind 클래스 (배지/막대). 한 곳에서 관리 */
export const TIER_COLOR_CLASS: Record<TierColor, { badge: string; dot: string; bar: string }> = {
  orange: { badge: 'bg-orange-500/15 text-orange-400', dot: 'bg-orange-500', bar: 'bg-orange-500' },
  purple: { badge: 'bg-purple-500/15 text-purple-400', dot: 'bg-purple-500', bar: 'bg-purple-500' },
  blue:   { badge: 'bg-blue-500/15 text-blue-400',     dot: 'bg-blue-500',   bar: 'bg-blue-500' },
  gray:   { badge: 'bg-gray-500/15 text-gray-300',     dot: 'bg-gray-400',   bar: 'bg-gray-400' },
}
