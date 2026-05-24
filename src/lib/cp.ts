// CP(전투력) 문자열 파서 — M(메가) 단위 정수로 정규화
// 예: "3.54G" → 3540, "120M" → 120, "999" → 999, "" → 0
// G(기가) = 1000M.

export function parseCp(raw: string | null | undefined): number {
  if (!raw) return 0
  const s = String(raw).trim().toUpperCase()
  if (!s) return 0
  const num = parseFloat(s.replace(/[^0-9.]/g, ''))
  if (isNaN(num)) return 0
  if (s.includes('G') || s.includes('B')) return Math.round(num * 1000)
  // M 또는 단위 없음(기본 M으로 간주)
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
