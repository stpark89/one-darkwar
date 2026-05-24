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
    // ※ client.navigate(url) 은 main.tsx 의 updatefound reload 와 충돌하여
    //   페이지가 절반 로드된 상태에서 멈추는 케이스가 있어 제거. reload 는
    //   client(main.tsx) 한 군데에서만 트리거.
  })())
})

// 빈 fetch 리스너 — 설치 가능 조건만 충족, 요청은 가로채지 않음
self.addEventListener('fetch', () => {})

self.__SW_VERSION = VERSION
