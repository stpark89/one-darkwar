import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envFile = readFileSync(join(__dirname, '../.env.local'), 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => l.replace(/"/g, '').split('=').map(s => s.trim()))
)

const url = env['VITE_PUBLIC_SUPABASE_URL']
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY']

if (!serviceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 없습니다.')
  console.error('   Supabase 대시보드 → Project Settings → API → service_role key 를 복사해서 추가하세요.')
  process.exit(1)
}

// service role key 로 admin 클라이언트 생성 (사용자 생성 권한)
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DEFAULT_PASSWORD = '123456'

// members 테이블에서 전체 멤버 로드
const { data: members, error: membersError } = await supabase.from('members').select('id, in_game_name')
if (membersError) { console.error('❌ 멤버 조회 오류:', membersError.message); process.exit(1) }
console.log(`📋 멤버 총 ${members.length}명`)

// 기존 profiles 조회 (중복 생성 방지)
const { data: existingProfiles } = await supabase.from('profiles').select('in_game_name')
const existingNames = new Set((existingProfiles ?? []).map(p => p.in_game_name))
console.log(`✅ 이미 등록된 프로필: ${existingNames.size}개`)

let created = 0
let skipped = 0
let failed = 0

for (const member of members) {
  const name = member.in_game_name

  if (existingNames.has(name)) {
    skipped++
    continue
  }

  const email = `${encodeURIComponent(name.trim().toLowerCase())}@onedarkwar.app`

  // auth user 생성 (admin API → 이메일 확인 불필요)
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,  // 이메일 확인 없이 바로 활성화
  })

  if (userError) {
    console.error(`❌ auth 생성 실패 [${name}]:`, userError.message)
    failed++
    continue
  }

  // profiles 테이블에 등록
  const { error: profileError } = await supabase.from('profiles').insert({
    id: userData.user.id,
    in_game_name: name,
    role: 'ROLE_USER',
  })

  if (profileError) {
    console.error(`❌ profile 생성 실패 [${name}]:`, profileError.message)
    failed++
    continue
  }

  console.log(`✅ [${name}] → ${email}`)
  created++
}

console.log('')
console.log(`=== 완료 ===`)
console.log(`생성: ${created}명 / 스킵(이미 존재): ${skipped}명 / 실패: ${failed}명`)
console.log(`기본 비밀번호: ${DEFAULT_PASSWORD}`)
