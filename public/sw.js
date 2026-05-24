// 최소 서비스 워커 — PWA 설치 가능 조건 충족용.
// 실질적인 오프라인 캐시는 하지 않고, fetch는 그대로 네트워크로 통과시킵니다.
// 추후 캐시 전략이 필요해지면 여기를 확장하세요.

const VERSION = 'one-darkwar-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // 명시적 패스스루 — 등록만 되어 있으면 설치 가능 조건은 만족합니다.
  event.respondWith(fetch(event.request).catch(() => new Response('', { status: 504 })))
})

// 빌드 버전 식별용 (디버그)
self.__SW_VERSION = VERSION
