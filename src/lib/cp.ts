// CP(전투력) / Migration Score 문자열 파서 — M(메가) 단위 정수로 정규화
//
// 지원 형식:
//   "3.54G" → 3540   "3G54" → 3540  (G/B 소수점 구분자)
//   "120M"  → 120
//   "999"   → 999    (M 단위 소수로 간주 — tier 임계값 입력용)
//   "245837410" → 246 (단위 없이 100만 이상이면 Migration Score raw 정수 → /1,000,000)
//
// Migration Score 는 게임 내 raw 정수(수억 단위)이므로 1,000,000 으로 나눠 M 단위로 정규화.
// 티어 임계값은 관리자가 "200", "3G" 처럼 M/G 표기로 입력하므로 기존 로직 유지.

export function parseCp(raw: string | null | undefined): number {
  if (!raw) return 0
  const s = String(raw).trim().toUpperCase()
  if (!s) return 0

  // "3G45" / "3B45" 처럼 G/B 가 소수점 구분자로 쓰인 경우 → 3.45G 로 해석
  const mid = s.match(/^(\d+)[GB](\d+)$/)
  if (mid) {
    const v = parseFloat(`${mid[1]}.${mid[2]}`)
    return isNaN(v) ? 0 : Math.round(v * 1000)
  }

  const num = parseFloat(s.replace(/[^0-9.]/g, ''))
  if (isNaN(num)) return 0

  if (s.includes('G') || s.includes('B')) return Math.round(num * 1000)
  if (s.includes('M')) return Math.round(num)

  // 단위 없음:
  // - 100만 미만 → M 단위 숫자로 간주 (예: "200" = 200M — 티어 임계값 입력)
  // - 100만 이상 → Migration Score raw 정수 → ÷1,000,000 하여 M 단위로 정규화
  if (num >= 1_000_000) return Math.round(num / 1_000_000)
  return Math.round(num)
}

// M 단위 정수 → 사람이 읽기 좋은 문자열 ("3.54G" / "120M")
export function formatCp(mega: number): string {
  if (mega >= 1000) {
    const g = mega / 1000
    return `${g.toFixed(g >= 10 ? 1 : 2)}G`
  }
  return `${mega}M`
}
