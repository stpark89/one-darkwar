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
  const { inGameName, newPassword } = req.body as { inGameName?: string; newPassword?: string }
  if (!inGameName || !newPassword) {
    return res.status(400).json({ error: 'inGameName and newPassword are required' })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  // 5) 인게임명으로 대상 계정 조회
  //    members.id 는 auth 계정 id 가 아니다 — 두 테이블은 인게임명으로만 연결된다.
  //    클라이언트가 보낸 id 를 그대로 믿으면 엉뚱한 계정을 바꿀 수 있으므로 서버에서 찾는다.
  //    대소문자·앞뒤 공백 차이가 있는 계정이 실제로 존재하므로 정확일치만으로는 못 찾는다.
  //    ilike 로 후보를 좁힌 뒤 정규화 비교로 확정한다(와일드카드 문자는 이스케이프).
  const nameKey = (s: string) => (s ?? '').trim().toLowerCase()
  const escaped = inGameName.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`)

  const { data: candidates, error: lookupErr } = await adminClient
    .from('profiles')
    .select('id, in_game_name')
    .ilike('in_game_name', escaped)

  if (lookupErr) {
    console.error('[admin/reset-password] lookup error:', lookupErr)
    return res.status(500).json({ error: 'Lookup failed' })
  }

  const targets = (candidates ?? []).filter(
    (c) => nameKey(c.in_game_name as string) === nameKey(inGameName),
  )
  if (targets.length === 0) {
    return res.status(404).json({ error: 'No login account found for this member' })
  }
  if (targets.length > 1) {
    return res.status(409).json({ error: 'Multiple accounts share this name' })
  }

  // 6) 비밀번호 변경
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(targets[0].id, {
    password: newPassword,
  })

  if (updateErr) {
    console.error('[admin/reset-password] update error:', updateErr)
    return res.status(500).json({ error: updateErr.message })
  }

  return res.status(200).json({ ok: true })
}
