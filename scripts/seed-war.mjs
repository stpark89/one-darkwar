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

// 1. 시즌 5 생성
const { data: season } = await supabase
  .from('seasons')
  .insert({ name: '시즌 5', is_active: true })
  .select().single()
console.log('✅ 시즌 생성:', season.name)

// 2. 회차 4개 생성
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

// sort_order 순서대로 정렬
rounds.sort((a, b) => a.sort_order - b.sort_order)

// 3. Supabase members 로드 (inGameName 매칭용)
const { data: members } = await supabase.from('members').select('id, in_game_name')
const memberMap = Object.fromEntries(members.map(m => [m.in_game_name, m.id]))

// 4. war_entries 삽입
const entries = []
for (const p of mockData.warParticipants) {
  const memberId = memberMap[p.inGameName]
  if (!memberId) {
    console.warn(`⚠️  멤버 없음: ${p.inGameName}`)
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

const { data: inserted, error } = await supabase.from('war_entries').insert(entries).select()
if (error) console.error('❌ 오류:', error.message)
else console.log(`✅ 전쟁 참가 기록 삽입: ${inserted.length}개`)
