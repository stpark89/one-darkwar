// YYYY-MM-DD ↔ 로컬 날짜 — new Date('YYYY-MM-DD') 는 UTC 로 읽혀 하루 밀릴 수 있어 직접 파싱한다

export const toIso = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`

export const parseIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (iso: string, n: number) => {
  const dt = parseIso(iso)
  dt.setDate(dt.getDate() + n)
  return toIso(dt)
}

/** 화면 표시용 — 반드시 앱 언어(i18n.language)를 넘긴다 */
export const formatIsoDate = (iso: string, lang: string, withYear = false) =>
  parseIso(iso).toLocaleDateString(lang, {
    ...(withYear ? { year: 'numeric' } : {}),
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  })
