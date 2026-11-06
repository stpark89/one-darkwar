import type { TFunction } from 'i18next'
import type { TierColor, TransferTier } from '@/domain/entities/TransferTier'

/**
 * 색 → 게임 등급명 i18n 키. 등급은 게임이 정한 이름이라 색과 1:1 로 대응한다.
 * 게임 등급: 일반(회색) · 중급(파랑) · 고급(보라) · 특급(주황) · 통솔자(빨강)
 */
const TIER_NAME_KEY: Partial<Record<TierColor, string>> = {
  red: 'tiers.name_red',
  orange: 'tiers.name_orange',
  purple: 'tiers.name_purple',
  blue: 'tiers.name_blue',
  gray: 'tiers.name_gray',
}

/** 화면 표시용 등급명. 편집 폼은 DB 이름(tier.name)을 직접 쓴다 */
export const tierDisplayName = (tier: Pick<TransferTier, 'name' | 'color'>, t: TFunction): string => {
  const key = TIER_NAME_KEY[tier.color]
  return key ? t(key) : tier.name
}
