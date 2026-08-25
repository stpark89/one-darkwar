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

  // 5) 대상 계정 확정 — members.profile_id (FK) 로 찾는다.
  //    members.id 는 auth 계정 id 가 아니므로 그대로 쓰면 엉뚱한 계정을 바꾼다.
  //    클라이언트가 보낸 계정 id 를 믿지 않고 서버가 멤버 행에서 읽어온다.
  const { data: member, error: memberErr } = await adminClient
    .from('members')
    .select('id, in_game_name, profile_id')
    .eq('id', memberId)
    .maybeSingle()

  if (memberErr) {
    console.error('[admin/reset-password] member lookup error:', memberErr)
    return res.status(500).json({ error: 'Lookup failed' })
  }
  if (!member) {
    return res.status(404).json({ error: 'Member not found' })
  }

  let targetId = member.profile_id as string | null

  // 폴백 — profile_id 마이그레이션 전이거나 아직 연결되지 않은 행.
  // 대소문자·앞뒤 공백만 다른 계정이 실제로 존재하므로 ilike 로 후보를 좁힌 뒤
  // 정규화 비교로 확정한다(와일드카드 % _ \ 는 이스케이프).
  if (!targetId) {
    const rawName = (member.in_game_name as string) ?? ''
    const nameKey = (s: string) => (s ?? '').trim().toLowerCase()
    const escaped = rawName.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`)

    const { data: candidates, error: lookupErr } = await adminClient
      .from('profiles')
      .select('id, in_game_name')
      .ilike('in_game_name', escaped)

    if (lookupErr) {
      console.error('[admin/reset-password] profile lookup error:', lookupErr)
      return res.status(500).json({ error: 'Lookup failed' })
    }

    const matches = (candidates ?? []).filter(
      (c) => nameKey(c.in_game_name as string) === nameKey(rawName),
    )
    if (matches.length > 1) {
      return res.status(409).json({ error: 'Multiple accounts share this name' })
    }
    targetId = matches[0]?.id ?? null
  }

  if (!targetId) {
    return res.status(404).json({ error: 'No login account found for this member' })
  }

  // 6) 비밀번호 변경
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(targetId, {
    password: newPassword,
  })

  if (updateErr) {
    console.error('[admin/reset-password] update error:', updateErr)
    return res.status(500).json({ error: updateErr.message })
  }

  return res.status(200).json({ ok: true })
}
