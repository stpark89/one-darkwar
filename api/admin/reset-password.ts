// Vercel Serverless Function: 관리자가 멤버 비밀번호 변경
//
// 필요한 환경변수 (Vercel Project Settings → Environment Variables):
//   - SUPABASE_URL             : 프로젝트 URL
//   - SUPABASE_SERVICE_ROLE_KEY: RLS 우회용 service_role 키

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin/reset-password] missing env vars')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  // 1) 요청자 JWT 추출
  const authHeader = req.headers['authorization'] ?? ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' })

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // 2) JWT로 요청자 식별
  const { data: { user: caller }, error: userErr } = await adminClient.auth.getUser(jwt)
  if (userErr || !caller) return res.status(401).json({ error: 'Invalid token' })

  // 3) 요청자가 관리자인지 확인
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (profile?.role !== 'ROLE_ADMIN') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // 4) 요청 바디 검증
  const { memberId, newPassword } = req.body as { memberId?: string; newPassword?: string }
  if (!memberId || !newPassword) {
    return res.status(400).json({ error: 'memberId and newPassword are required' })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  // 5) 비밀번호 변경
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(memberId, {
    password: newPassword,
  })

  if (updateErr) {
    console.error('[admin/reset-password] update error:', updateErr)
    return res.status(500).json({ error: updateErr.message })
  }

  return res.status(200).json({ ok: true })
}
