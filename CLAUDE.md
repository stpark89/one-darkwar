# CLAUDE.md

ONE DARK WAR 길드 관리 앱 (React + Vite + Supabase + zustand + i18next) 작업 가이드.
새 메뉴 / 스토어 / 페이지를 추가할 때 **반드시 아래 규칙을 따른다**.

---

## 1. Store 패턴 (zustand) — 무한 로딩 방지

### ✅ 표준 패턴

모든 비동기 `load*` 함수는 아래 형태로 작성한다:

```ts
loadXxx: async () => {
  set({ loading: true })                 // 가드 없이 무조건 true
  try {
    const { data, error } = await supabase.from('xxx').select('*')
    if (error) {
      console.error('[xxxStore] loadXxx error:', error)
      return                              // 기존 데이터 유지
    }
    set({ items: (data ?? []).map(toX) })
  } catch (err) {
    console.error('[xxxStore] loadXxx exception:', err)
  } finally {
    set({ loading: false })               // 어떤 경로로 끝나도 보장
  }
}
```

### ❌ 금지

- **`if (get().loading) return` 같은 가드 사용 금지.**
  supabase fetch 가 hang 되면 `loading=true` 로 stuck 되고, 이후 모든
  호출이 가드로 차단되어 새로고침 전까지 무한 spinner 가 됨.
- **`try-finally` 없이 마지막 줄에서만 `loading=false`** 도 금지.
  중간에 throw 하면 `loading=true` 가 영구 stuck.

### ✅ 허용

- 다중 호출 시 마지막 `set` 이 이긴다는 zustand 동작에 맡긴다. 약간의
  깜빡임은 있을 수 있지만 stuck 은 안 일어남.
- 한 스토어가 여러 로딩 상태를 갖는다면 (`loading`, `rejectedLoading`,
  `approvedLoading` 등) 각각에 같은 try-finally 적용.

### 페이지에서 여러 store 를 동시에 로드할 때

`HomePage` 처럼 mount 시 여러 store 의 load 함수를 동시에 호출하는
패턴은 페이지 자체의 `loading` 상태도 같은 규칙을 따른다:

```tsx
useEffect(() => {
  const init = async () => {
    setLoading(true)
    try {
      const promises = [loadA(), loadB(), loadC()]
      // Promise.all 대신 allSettled — 일부 실패해도 나머지 완료 보장
      await Promise.allSettled(promises)
    } catch (err) {
      console.error('[Page] init exception:', err)
    } finally {
      setLoading(false)   // 어떤 경로로 끝나도 spinner 풀림
    }
  }
  init()
}, [])
```

❌ `Promise.all` + try-finally 없음 → 하나라도 reject 되면 setLoading(false)
미실행 → 무한 spinner.

✅ `Promise.allSettled` + try-finally → 어떤 상황에서도 spinner 풀림.

---

## 2. 외부 호출 hang 방지 (auth / 결제 등)

`supabase.auth.signOut()` 처럼 외부 의존이 hang 될 가능성이 있는 함수는
`Promise.race` 안전망을 씌운다:

```ts
signOut: async () => {
  try {
    await Promise.race([
      supabase.auth.signOut(),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ])
  } catch (err) {
    console.error('[authStore] signOut exception:', err)
  }
  localStorage.removeItem(GUEST_FLAG_KEY)
  set({ user: null, isGuest: false })
}
```

---

## 3. 다국어 (i18next)

새 텍스트 키 추가 시 **반드시 4개 파일 모두** 업데이트:

- `src/i18n/locales/ko.ts`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/vi.ts`
- `src/i18n/locales/zh-TW.ts`

3개만 업데이트하면 누락된 언어 사용자에게 빈 키가 노출된다.
한 곳에 키를 추가했으면 같은 PR 안에서 나머지도 같이 추가.

---

## 4. Supabase 마이그레이션

DB 스키마 변경 시:

1. `supabase/migration_<설명>.sql` 신규 파일 작성
2. `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` 사용 — 재실행 안전성 확보
3. RLS 정책도 같은 파일 안에 `DROP POLICY IF EXISTS` + `CREATE POLICY` 패턴
4. 사용자에게 **"Supabase Dashboard → SQL Editor 에서 실행 필요"** 명시
5. commit 메시지에도 `※ SQL Editor 에서 실행 필요` 표기

---

## 5. 권한 가드

페이지 진입 시 권한 분기는 `Layout.tsx` 와 각 페이지에서 처리:

| 상태 | 처리 |
|------|------|
| 로그인 안 됨 + 게스트 아님 | `<Navigate to="/sign-in" />` (Layout) |
| 게스트 + `GUEST_ALLOWED` 외 경로 | `<Navigate to="/" />` (Layout) |
| 일반 회원 + 관리자 전용 페이지 | 페이지 안에서 `<Navigate to="/" />` |
| 존재하지 않는 경로 | `<Route path="*" element={<Navigate to="/" replace />} />` (App.tsx) |

게스트 화이트리스트는 [`Layout.tsx`](src/presentation/components/Layout.tsx) 의
`GUEST_ALLOWED` 배열에서 관리. 게스트 전용 메뉴 추가 시 그 배열에 경로
추가하는 것 잊지 말 것.

---

## 6. 사이드바 메뉴

[`Sidebar.tsx`](src/presentation/components/Sidebar.tsx) 의 세 가지 배열로
사용자 그룹별 메뉴를 관리:

- `NAV_GENERAL` — 로그인한 일반 회원·관리자 공통
- `NAV_GUEST` — 게스트 전용 (홈/질문/이주신청 등 외부인 진입로)
- `NAV_ADMIN` — 관리자만 (`user.role === 'ROLE_ADMIN'`)

새 메뉴 추가 시 위 3개 중 어디에 속할지 명확히 분류한다.
게스트한테도 보여야 하면 **`NAV_GUEST` 에도 추가** + `Layout.tsx` 의
`GUEST_ALLOWED` 화이트리스트에도 경로 추가.

---

## 7. PWA / 캐시

- 설치 버튼은 `HomePage` 의 `cleanupBeforeInstall` 을 거친다 — 옛 캐시·SW
  자동 정리 후 prompt.
- **`localStorage` / `IndexedDB` 는 절대 건드리지 않는다** — Supabase
  auth 세션이 거기 저장되어 있어 지우면 로그아웃당함.
- `localStorage` 의 `odw_guest` 플래그는 게스트 모드 유지용. 명시적
  signOut 시에만 제거.

---

## 8. 빌드 / 배포

```bash
npm run build      # tsc -b && vite build — 타입 오류·빌드 동시 검증
npm run icons      # SVG/PNG → 4크기 PWA 아이콘 재생성 (선택)
git push origin main   # Vercel 자동 배포 (1~2분)
```

배포 후 사용자 확인 단계:
1. Vercel 배포 완료 (대시보드)
2. 마이그레이션 SQL 실행 (해당하면)
3. 브라우저 새로고침 또는 PWA 재설치 (UI 변경분 반영)

---

## 9. 자주 쓰는 헬퍼

- [`src/lib/cp.ts`](src/lib/cp.ts) — `parseCp("3.54G") → 3540 (M단위)`, `formatCp`
- [`src/lib/translate.ts`](src/lib/translate.ts) — MyMemory API
  (`translateText(text, lang)`)
- [`src/lib/avatars.ts`](src/lib/avatars.ts) — 동맹 아바타 풀, 사이드바·
  히어로에서 `getSessionAvatar()` 사용
- [`src/infrastructure/stores/transferTierStore.ts`](src/infrastructure/stores/transferTierStore.ts)
  의 `findTierForCp(tiers, cpMega)` — CP 로 티켓 등급 매칭

---

## 10. 새 기능 추가 체크리스트

1. [ ] DB 변경 → `supabase/migration_*.sql` 작성 + 실행 안내
2. [ ] 도메인 타입 → `src/domain/entities/*.ts`
3. [ ] 스토어 → `src/infrastructure/stores/*.ts` (위 1번 패턴 준수)
4. [ ] 페이지 → `src/presentation/pages/*.tsx`
5. [ ] 라우트 → `src/App.tsx`
6. [ ] 사이드바 메뉴 → `src/presentation/components/Sidebar.tsx`
       (NAV_GENERAL / NAV_GUEST / NAV_ADMIN 중 적절히)
7. [ ] 게스트 허용 경로면 → `Layout.tsx` 의 `GUEST_ALLOWED` 에도 추가
8. [ ] 다국어 4종 — ko / en / vi / zh-TW
9. [ ] 빌드 통과 (`npm run build`)
10. [ ] commit & push, 사용자에게 SQL 실행 필요 여부 안내
