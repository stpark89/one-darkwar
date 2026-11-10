// MyMemory 무료 번역 API 래퍼.
//
// ⚠️ i18n.language 를 그대로 넘기지 마라. LanguageDetector 가 navigator 에서 읽으면
// 'ko-KR' 처럼 지역 코드가 붙어 오는데, 예전 매핑은 그걸 못 찾고 'en' 으로 떨어뜨려
// **한국어 사용자에게 영어 번역을 보여줬다**(2026-09-28). 언어 선택기로 한 번이라도
// 고른 사람은 localStorage 에 'ko' 가 남아 정상이라, 증상이 일부에게만 나타났다.

const MYMEMORY_LANG: Record<string, string> = {
  ko: 'ko', en: 'en', vi: 'vi', 'zh-TW': 'zh-TW', zh: 'zh',
}

/** 'ko-KR' → 'ko' 처럼 지역 코드를 떼어 MyMemory 가 아는 코드로 맞춘다. */
export function normalizeLang(lang: string): string {
  if (MYMEMORY_LANG[lang]) return MYMEMORY_LANG[lang]

  // zh-TW / zh-Hant 계열은 번체로, 그 외 중국어는 간체로
  const lower = lang.toLowerCase()
  if (lower.startsWith('zh')) {
    return /tw|hant|hk|mo/.test(lower) ? 'zh-TW' : 'zh'
  }

  const base = lang.split('-')[0]
  return MYMEMORY_LANG[base] ?? base
}

// 원문이 이미 대상 언어일 때 MyMemory 가 돌려주는 문구. responseStatus 는 200 이라
// 에러로 안 잡히고, 그대로 화면에 뿌리면 사용자에게는 "번역이 안 된 것"으로 보인다.
const SAME_LANG_MARKER = 'PLEASE SELECT TWO DISTINCT LANGUAGES'

export interface TranslateResult {
  text: string
  /** API 가 판별한 원문 언어. 판별하지 못하면 null */
  detectedLang: string | null
  /** 원문이 이미 대상 언어인 경우 — 결과가 원문과 같아도 오류가 아니다 */
  sameLanguage: boolean
}

// MyMemory 는 한 번에 **500자**까지만 받는다(글자 수 기준 — 실측 2026-11-10: 한국어 400자·1100바이트 통과,
// 영어 501자 거절). 넘으면 responseStatus "403" + 「QUERY LENGTH LIMIT EXCEEDED」로 실패해 긴 공지·게시글이
// 번역되지 않았다. 여유를 두고 나눈다. 줄바꿈은 API 가 보존한다(실측).
const MAX_CHUNK = 450

/** 마지막 문장 끝(마침표·물음표·느낌표 + 공백/끝) 바로 뒤 위치. 없으면 -1 */
function lastSentenceEnd(s: string): number {
  let idx = -1
  for (const m of s.matchAll(/[.!?。！？](?=\s|$)/g)) idx = (m.index ?? 0) + 1
  return idx
}

/** 줄 → 문장 → 공백 순으로 자르기 좋은 곳을 찾아 MAX_CHUNK 이하 조각으로 나눈다. 이어 붙이면 원문 그대로다. */
export function splitForTranslation(text: string, max = MAX_CHUNK): string[] {
  const pieces: string[] = []
  let rest = text
  while (rest.length > max) {
    const window = rest.slice(0, max)
    const minCut = Math.floor(max * 0.3) // 너무 짧은 조각은 문맥이 없어 번역 품질이 떨어진다
    let cut = window.lastIndexOf('\n')
    if (cut < minCut) cut = lastSentenceEnd(window)
    if (cut < minCut) cut = window.lastIndexOf(' ')
    if (cut < minCut) cut = max
    pieces.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  pieces.push(rest)
  return pieces
}

/**
 * 원문을 대상 언어로 번역한다. 500자를 넘으면 나눠 번역해 이어 붙인다.
 * 실패 시 throw — 호출부에서 사용자에게 알린다.
 */
export async function translate(text: string, targetLang: string): Promise<TranslateResult> {
  if (text.length <= MAX_CHUNK) return translateChunk(text, targetLang)

  // 조각 앞뒤 공백·줄바꿈은 번역에 보내지 않고 그대로 되붙인다
  const parts = splitForTranslation(text).map((p) => {
    const m = p.match(/^(\s*)([\s\S]*?)(\s*)$/)!
    return { lead: m[1], body: m[2], tail: m[3] }
  })
  const results = await Promise.all(
    parts.map((p) => (p.body ? translateChunk(p.body, targetLang) : Promise.resolve(null))),
  )

  const joined = parts.map((p, i) => p.lead + (results[i]?.text ?? p.body) + p.tail).join('')
  const translated = results.filter((r): r is TranslateResult => r !== null)
  return {
    text: joined,
    detectedLang: translated.find((r) => r.detectedLang)?.detectedLang ?? null,
    sameLanguage: translated.length > 0 && translated.every((r) => r.sameLanguage),
  }
}

/** 500자 이하 한 조각을 번역한다. */
async function translateChunk(text: string, targetLang: string): Promise<TranslateResult> {
  const lang = normalizeLang(targetLang)
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${lang}`,
  )
  const data = await res.json()
  const detected: string | null = data.responseData?.detectedLanguage ?? null
  const translated = String(data.responseData?.translatedText ?? '')

  // 같은 언어면 번역할 게 없다 — 원문을 그대로 돌려주고 호출부가 안내하게 한다.
  // ⚠️ 상태 검사보다 먼저 봐야 한다: 이 경우 MyMemory 는 responseStatus 를 문자열 "403" 으로
  // 준다. 상태를 먼저 보면 throw → 호출부가 조용히 삼켜 **버튼이 무반응**이 된다(2026-11-10).
  const details = String(data.responseDetails ?? '')
  if (translated.toUpperCase().includes(SAME_LANG_MARKER) || details.toUpperCase().includes(SAME_LANG_MARKER)) {
    return { text, detectedLang: detected ?? lang, sameLanguage: true }
  }

  if (Number(data.responseStatus) !== 200) {
    throw new Error(details || 'Translation failed')
  }
  if (detected && normalizeLang(detected) === lang) {
    return { text: translated, detectedLang: detected, sameLanguage: true }
  }

  return { text: translated, detectedLang: detected, sameLanguage: false }
}

/** 기존 호출부 호환 — 번역문만 필요할 때. */
export async function translateText(text: string, targetLang: string): Promise<string> {
  const { text: translated } = await translate(text, targetLang)
  return translated
}
