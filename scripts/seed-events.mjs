import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mockData = JSON.parse(readFileSync(join(__dirname, '../src/infrastructure/mockData.json'), 'utf-8'))
const envFile = readFileSync(join(__dirname, '../.env.local'), 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => l.replace(/"/g, '').split('=').map(s => s.trim()))
)

const supabase = createClient(env['VITE_PUBLIC_SUPABASE_URL'], env['VITE_PUBLIC_SUPABASE_ANON_KEY'])

// attendance 이름 → members 이름 수동 매핑 (타이포/옛 이름 등)
const NAME_MAP = {
  // 대소문자 fix
  'alone star': 'Alone Star',
  'ArGy': 'Argy',
  'Bin sama': 'Bin Sama',
  'cây cỏ': 'Cây cỏ',
  'junN': 'Junn',
  'just chilling': 'Just chilling',
  // 이름 변경 / 타이포
  '允雁-Yun Yan': 'Yun Yan',
  'Anh Túوخ ول وت': 'A Tú',
  'CAPPYBABI': 'CAPYBABI',
  'Carott': 'Carot',
  'Jagerrr': 'Jagerr',
  'Konnie2211': 'Konnie',
  'Kosoma': 'Kasoma',
  'Kube': 'Kubê',
  'Lazy Famer': 'Lazy Farmer',
  'Maii Laan': 'Mai Lan',
}

// 이름 해석 함수: 수동 맵 → 대소문자 무시 → NFC+공백 제거 순으로 시도
function resolveName(name, memberNames, memberLower, memberNorm) {
  if (NAME_MAP[name]) return NAME_MAP[name]
  if (memberNames.has(name)) return name
  const lower = memberLower.get(name.toLowerCase())
  if (lower) return lower
  const norm = name.toLowerCase().normalize('NFC').replace(/\s+/g, '')
  return memberNorm.get(norm) ?? null
}

// 1. 기존 events / attendance 삭제 후 재삽입
const { data: existingEvents } = await supabase.from('events').select('id')
if (existingEvents?.length > 0) {
  await supabase.from('attendance').delete().in('event_id', existingEvents.map(e => e.id))
  await supabase.from('events').delete().in('id', existingEvents.map(e => e.id))
  console.log(`🗑️  기존 이벤트 ${existingEvents.length}개 삭제 완료`)
}

// 2. 이벤트 삽입 (old eventKey → new UUID 매핑)
const eventKeyToId = {}
for (const e of mockData.events) {
  const { data, error } = await supabase
    .from('events')
    .insert({ name: e.name, event_date: e.date || null })
    .select().single()
  if (error) { console.error('❌ 이벤트 삽입 오류:', error.message); continue }
  eventKeyToId[e.eventKey] = data.id
}
console.log(`✅ 이벤트 삽입: ${Object.keys(eventKeyToId).length}개`)

// 3. members 로드
const { data: members } = await supabase.from('members').select('id, in_game_name')
const memberNames = new Set(members.map(m => m.in_game_name))
const memberLower = new Map(members.map(m => [m.in_game_name.toLowerCase(), m.in_game_name]))
const memberNorm = new Map(members.map(m => [m.in_game_name.toLowerCase().normalize('NFC').replace(/\s+/g, ''), m.in_game_name]))
const memberMap = Object.fromEntries(members.map(m => [m.in_game_name, m.id]))

// 4. attendance 삽입 (CT/DB 상태인 것만)
const entries = []
let skipped = 0
for (const a of mockData.attendance) {
  const resolvedName = resolveName(a.inGameName, memberNames, memberLower, memberNorm)
  if (!resolvedName) {
    console.warn(`⚠️  멤버 없음 (구 멤버): ${a.inGameName}`)
    skipped++
    continue
  }
  const memberId = memberMap[resolvedName]
  if (!memberId) {
    console.warn(`⚠️  ID 조회 실패: ${resolvedName}`)
    skipped++
    continue
  }
  for (const [eventKey, status] of Object.entries(a.records)) {
    if (status === 'CT' || status === 'DB') {
      const eventId = eventKeyToId[eventKey]
      if (eventId) entries.push({ member_id: memberId, event_id: eventId, status })
    }
  }
}

console.log(`📊 매칭: ${mockData.attendance.length - skipped}명, 스킵: ${skipped}명`)

const { data: inserted, error } = await supabase.from('attendance').insert(entries).select()
if (error) console.error('❌ 오류:', error.message)
else console.log(`✅ 출석 기록 삽입: ${inserted.length}개`)
