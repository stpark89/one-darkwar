// PWA 설치 가능 조건 충족용 최소 서비스 워커.
// fetch 리스너는 "등록"만 되어 있으면 PWA 설치 조건을 만족하므로,
// respondWith를 호출하지 않아 브라우저 기본 동작(네트워크 그대로)에 맡깁니다.
// 새 SW 가 active 되면 자동으로 모든 클라이언트를 새 빌드로 reload.

const VERSION = 'one-darkwar-v3'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 이전 버전이 만들었을 수 있는 모든 Cache Storage 항목 정리
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
    await self.clients.claim()
    // 새 SW 활성화 — 열려있는 모든 PWA 창을 강제로 새로고침하여
    // 옛 HTML/JS 가 메모리에 남아있는 경우에도 즉시 최신 빌드로 전환.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) {
      try { w.navigate(w.url) } catch { /* navigate 미지원 환경 — 무시 */ }
    }
  })())
})

// 빈 fetch 리스너 — 설치 가능 조건만 충족, 요청은 가로채지 않음
self.addEventListener('fetch', () => {})

self.__SW_VERSION = VERSION
