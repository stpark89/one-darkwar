// PWA 설치 가능 조건 충족용 최소 서비스 워커 + Web Push 핸들러.
// fetch 리스너는 "등록"만 되어 있으면 PWA 설치 조건을 만족하므로,
// respondWith를 호출하지 않아 브라우저 기본 동작(네트워크 그대로)에 맡깁니다.
// 새 SW 가 active 되면 자동으로 모든 클라이언트를 새 빌드로 reload.

const VERSION = 'one-darkwar-v4-push'

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

// ────────────────────────────────────────────────────────────────
// Web Push
// ────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  // 페이로드는 서버(Vercel API)가 JSON 으로 전송
  // { title, body, url, tag }
  let data = { title: 'ONE DARK WAR', body: '', url: '/', tag: 'odw' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch (e) {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // 이미 열린 PWA/탭이 있으면 그쪽으로 포커스 + 라우팅
    for (const c of allClients) {
      if ('focus' in c) {
        try { await c.focus() } catch (e) { /* ignore */ }
        try { await c.navigate(targetUrl) } catch (e) { /* navigate 실패해도 focus 는 됨 */ }
        return
      }
    }
    // 없으면 새 창
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl)
    }
  })())
})

self.__SW_VERSION = VERSION
