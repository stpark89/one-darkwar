// Vercel Serverless Function: Supabase Database Webhook 수신 → 관리자에게 Web Push 발송
//
// 트리거: transfer_applications 테이블의 INSERT (Supabase Dashboard 에서 webhook 설정)
//
// 필요한 환경변수 (Vercel Project Settings → Environment Variables):
//   - VAPID_PRIVATE_KEY        : VAPID 개인키
//   - VAPID_SUBJECT            : mailto:admin@... 형식
//   - PUSH_WEBHOOK_SECRET      : Supabase webhook 헤더와 일치할 시크릿
//   - SUPABASE_URL             : 프로젝트 URL
//   - SUPABASE_SERVICE_ROLE_KEY: RLS 우회용 service_role 키
//
// 클라이언트 노출 가능 (공개) 환경변수:
//   - VITE_VAPID_PUBLIC_KEY  : .env / 클라이언트 빌드 시 사용

import type { VercelRequest, VercelResponse } from '@vercel/node'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// 한 번만 VAPID 설정
const VAPID_PUBLIC_KEY = 'BLKAV8vNpZlkld3-mMqtVmAJQaLIj334ixAmtCZ9xbdoDqykUO4ovxbEv0bM8KfvN2YKo4EzdZAS2PiWChCEjuU'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@onedarkwar.app'
const WEBHOOK_SECRET = process.env.PUSH_WEBHOOK_SECRET || ''
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

interface SupabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: Record<string, unknown>
  old_record: Record<string, unknown> | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 1) 시크릿 검증
  const headerSecret = req.headers['x-webhook-secret']
  if (!WEBHOOK_SECRET || headerSecret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // 2) 환경변수 체크
  if (!VAPID_PRIVATE_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[push/transfer] missing env vars')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const payload = req.body as SupabaseWebhookPayload
  if (payload?.type !== 'INSERT' || payload?.table !== 'transfer_applications') {
    return res.status(200).json({ skipped: true })
  }

  const record = payload.record as { in_game_name?: string; current_server?: string; country?: string; cp?: string }
  const inGameName = record.in_game_name || '(unknown)'
  const server = record.current_server || ''
  const country = record.country || ''
  const cp = record.cp || ''

  // 3) 관리자 push 구독 전체 로드 (service_role 로 RLS 우회)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // profiles 에서 ROLE_ADMIN 인 user_id 목록 → push_subscriptions 조회
  const { data: admins, error: adminErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'ROLE_ADMIN')

  if (adminErr || !admins) {
    console.error('[push/transfer] admin load error:', adminErr)
    return res.status(500).json({ error: 'admin load failed' })
  }
  const adminIds = admins.map((a) => a.id)
  if (adminIds.length === 0) return res.status(200).json({ sent: 0 })

  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', adminIds)

  if (subErr || !subs) {
    console.error('[push/transfer] subs load error:', subErr)
    return res.status(500).json({ error: 'subs load failed' })
  }

  // 4) 알림 페이로드
  const notif = {
    title: '새 이주 신청',
    body: [inGameName, server, country, cp].filter(Boolean).join(' · '),
    url: '/transfer',
    tag: 'transfer-new',
  }

  // 5) 일괄 발송 (실패해도 다른 건 계속)
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(notif),
      ),
    ),
  )

  // 6) 410/404 (구독 만료) 인 endpoint 는 DB 에서 정리
  const stale: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const err = r.reason as { statusCode?: number }
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        stale.push(subs[i].endpoint)
      } else {
        console.warn('[push/transfer] send failed:', err)
      }
    }
  })
  if (stale.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', stale)
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length
  return res.status(200).json({ sent, stale: stale.length })
}
