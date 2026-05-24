// PWA 설치 가능 조건 충족용 최소 서비스 워커.
// fetch 리스너는 "등록"만 되어 있으면 PWA 설치 조건을 만족하므로,
// respondWith를 호출하지 않아 브라우저 기본 동작(네트워크 그대로)에 맡깁니다.
// 이렇게 해야 빌드 해시가 바뀌어도 캐시 미스매치로 흰 화면이 나오지 않습니다.

const VERSION = 'one-darkwar-v2'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 이전 버전이 만들었을 수 있는 모든 Cache Storage 항목 정리
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

// 빈 fetch 리스너 — 설치 가능 조건만 충족, 요청은 가로채지 않음
self.addEventListener('fetch', () => {})

self.__SW_VERSION = VERSION
