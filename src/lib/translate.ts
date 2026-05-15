const MYMEMORY_LANG: Record<string, string> = {
  ko: 'ko', en: 'en', vi: 'vi', 'zh-TW': 'zh-TW', zh: 'zh',
}

export async function translateText(text: string, targetLang: string): Promise<string> {
  const lang = MYMEMORY_LANG[targetLang] ?? 'en'
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${lang}`,
  )
  const data = await res.json()
  if (data.responseStatus === 200) return data.responseData.translatedText as string
  throw new Error(data.responseDetails ?? 'Translation failed')
}
