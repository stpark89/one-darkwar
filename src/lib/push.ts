// 웹 푸시 구독 헬퍼.
// - VAPID public key 는 빌드 시점에 클라이언트에 포함 (공개 가능)
// - 구독 정보는 supabase push_subscriptions 테이블에 저장
// - 동일 endpoint 가 다시 들어오면 INSERT 시 unique 제약으로 거절되므로 그냥 무시

import { supabase } from '@/lib/supabase'

// .env / Vercel env 로 받되, 없으면 빌드 시점에 박힌 디폴트 사용 (개발용)
const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ??
  'BLKAV8vNpZlkld3-mMqtVmAJQaLIj334ixAmtCZ9xbdoDqykUO4ovxbEv0bM8KfvN2YKo4EzdZAS2PiWChCEjuU'

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// base64url → Uint8Array (PushManager subscribe 가 요구)
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/** 현재 브라우저의 구독 객체 (없으면 null) */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** 알림 권한 + 구독 + DB 저장. 성공 시 PushSubscription 반환 */
export async function subscribeToPush(userId: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.')
  }
  // 권한 요청
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    throw new Error('알림 권한이 거부되었습니다.')
  }
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    // applicationServerKey 는 strict BufferSource(ArrayBuffer) 요구 — Uint8Array.buffer 로 캐스팅
    const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer as ArrayBuffer,
    })
  }
  // DB 저장 (unique endpoint — 이미 있으면 그냥 통과)
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    console.error('[push] DB insert error:', error)
    throw new Error('구독 정보 저장에 실패했습니다.')
  }
  return sub
}

/** 구독 해제 + DB 삭제 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  try {
    await sub.unsubscribe()
  } catch (e) {
    console.warn('[push] unsubscribe failed:', e)
  }
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) console.error('[push] DB delete error:', error)
}

/** 현재 구독 상태 (DB 와 무관, 브라우저 기준) */
export async function isCurrentlySubscribed(): Promise<boolean> {
  const sub = await getCurrentSubscription()
  return sub !== null
}
