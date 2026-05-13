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

// warParticipants 이름 → members 이름 매핑 (옛 인게임 이름 → 현재 이름)
const NAME_MAP = {
  'Lazy farmer': 'Lazy Farmer',
  'junN': 'Junn',
  'Thỏ Cùi Chỏ': 'Thỏ cùi chỏ',
  'Sun': 'SUN',
  'Hug': 'HuG',
  'RUNA': 'Runa',
  'Sinh Tố Lúa Mạch': 'Sinh tố lúa mạch',
  'Thỏ sa mạc': 'Thỏ Sa Mạc',
  'cây cỏ': 'Cây cỏ',
  'Lửng 7 Mạng': 'Lửng 7 mạng',
  'Thỏ Mù Màu': 'Thỏ mù màu',
  'just chilling': 'Just chilling',
  'RadaGon': 'Radagon',
  'slu7': 'Slu7',
  'DKha': 'Dkha',
  'Alone star': 'Alone Star',
  'Bò đi Mid': 'Bò đi mid',
  'Tiểu gia chủ': 'Tiểu Gia Chủ',
  'Yunyan': 'Yun Yan',
  'Lu Wei': 'Luwei',
  'Xu Xu': 'XuXu',
  'kai-kilsd': 'Kai - kilsd',
  'Gấu BắcCực': 'Gấu Bắc Cực',
  'H ư n g': 'Hưng',
}

// 1. 기존 데이터 삭제 (재실행 안전)
const { data: existingSeasons } = await supabase.from('seasons').select('id').eq('name', '시즌 5')
if (existingSeasons?.length > 0) {
  const ids = existingSeasons.map(s => s.id)
  const { data: rounds } = await supabase.from('war_rounds').select('id').in('season_id', ids)
  if (rounds?.length > 0) {
    await supabase.from('war_entries').delete().in('round_id', rounds.map(r => r.id))
  }
  await supabase.from('war_rounds').delete().in('season_id', ids)
  await supabase.from('seasons').delete().in('id', ids)
  console.log('🗑️  기존 시즌 5 데이터 삭제 완료')
}

// 2. 시즌 5 생성
const { data: season, error: seasonError } = await supabase
  .from('seasons')
  .insert({ name: '시즌 5', is_active: true })
  .select().single()
if (seasonError) { console.error('❌ 시즌 생성 오류:', seasonError.message); process.exit(1) }
console.log('✅ 시즌 생성:', season.name)

// 3. 회차 4개 생성
const roundDates = [
  { sort_order: 1, round_date: '2026-03-29' },
  { sort_order: 2, round_date: '2026-04-19' },
  { sort_order: 3, round_date: '2026-04-26' },
  { sort_order: 4, round_date: '2026-05-10' },
]
const { data: rounds } = await supabase
  .from('war_rounds')
  .insert(roundDates.map(r => ({ ...r, season_id: season.id })))
  .select()
console.log(`✅ 회차 생성: ${rounds.length}개`)

rounds.sort((a, b) => a.sort_order - b.sort_order)

// 4. Supabase members 로드
const { data: members } = await supabase.from('members').select('id, in_game_name')
const memberMap = Object.fromEntries(members.map(m => [m.in_game_name, m.id]))

// 5. war_entries 삽입
const entries = []
let skipped = 0
for (const p of mockData.warParticipants) {
  const resolvedName = NAME_MAP[p.inGameName] ?? p.inGameName
  const memberId = memberMap[resolvedName]
  if (!memberId) {
    console.warn(`⚠️  멤버 없음 (구 멤버): ${p.inGameName}`)
    skipped++
    continue
  }
  for (let i = 1; i <= 4; i++) {
    const round = p[`round${i}`]
    const team = round?.team?.trim() ?? ''
    const role = round?.role?.trim() ?? ''
    const validTeam = ['A', 'B'].includes(team) ? team : ''
    const validRole = ['CT', 'DB'].includes(role) ? role : ''
    if (validTeam && validRole) {
      entries.push({
        round_id: rounds[i - 1].id,
        member_id: memberId,
        team: validTeam,
        role: validRole,
      })
    }
  }
}

console.log(`📊 매칭: ${mockData.warParticipants.length - skipped}명, 스킵: ${skipped}명`)

const { data: inserted, error } = await supabase.from('war_entries').insert(entries).select()
if (error) console.error('❌ 오류:', error.message)
else console.log(`✅ 전쟁 참가 기록 삽입: ${inserted.length}개`)
