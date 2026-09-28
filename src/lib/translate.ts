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

/**
 * 원문을 대상 언어로 번역한다.
 * 실패 시 throw — 호출부에서 사용자에게 알린다.
 */
export async function translate(text: string, targetLang: string): Promise<TranslateResult> {
  const lang = normalizeLang(targetLang)
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${lang}`,
  )
  const data = await res.json()
  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails ?? 'Translation failed')
  }

  const detected: string | null = data.responseData?.detectedLanguage ?? null
  const translated = String(data.responseData.translatedText ?? '')

  // 같은 언어면 번역할 게 없다 — 원문을 그대로 돌려주고 호출부가 안내하게 한다
  if (translated.toUpperCase().includes(SAME_LANG_MARKER)) {
    return { text, detectedLang: detected ?? lang, sameLanguage: true }
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
