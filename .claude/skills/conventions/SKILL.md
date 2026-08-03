---
name: conventions
description: ONE-DarkWar 프로젝트 실제 코드에서 추출한 레이어·명명·검증 규칙. developer/design-ui/test 등 workflow 스킬의 1순위 참조.
---

# ONE-DarkWar Conventions

> 스택: React 19 + Vite + TypeScript · Zustand · Tailwind CSS v4 · Supabase · React Router v6  
> 배포: Vercel (SPA rewrite) · DB/Auth/Realtime: Supabase

## 폴더 구조

```
src/
├── presentation/
│   ├── pages/          # 라우트 진입 페이지 컴포넌트
│   └── components/     # 재사용 UI 컴포넌트
│       └── ui/         # 기본 UI 원자 (button, input, badge …)
├── infrastructure/
│   └── stores/         # Zustand 스토어 (상태 + Supabase 호출 조합)
├── domain/
│   └── entities/       # 순수 타입/인터페이스만
├── hooks/              # 커스텀 훅
├── i18n/               # 다국어 (ko/vi/en)
│   └── locales/
├── lib/                # 유틸 (avatars, push, uploadMedia, utils)
└── app/                # 라우터 설정, 앱 진입점
```

## 레이어 규칙 (단방향)

```
domain/entities  →  infrastructure/stores  →  presentation/pages & components
                                           →  hooks/
```

- **pages**: 스토어 훅만 호출 — 직접 Supabase 호출 금지
- **stores**: Supabase 호출 + Zustand 상태 관리 조합
- **domain/entities**: 순수 타입만 — 로직 없음
- **components/ui/**: shadcn 기반 원자 — 스토어 import 금지

## 태스크 태그

| 태그 | 생성 위치 |
|------|----------|
| `[Entity]` | `src/domain/entities/` |
| `[Store]` | `src/infrastructure/stores/` |
| `[Page]` | `src/presentation/pages/` |
| `[Component]` | `src/presentation/components/` |
| `[Hook]` | `src/hooks/` |
| `[Lib]` | `src/lib/` |
| `[i18n]` | `src/i18n/locales/` |

## 명명 규칙

| 대상 | 규칙 | 예 |
|------|------|----|
| 페이지 | PascalCase + `Page` | `MembersPage.tsx` |
| 컴포넌트 | PascalCase | `ChatWidget.tsx`, `VoicePanel.tsx` |
| 스토어 훅 | `use` + 도메인 + `Store` | `useMemberStore`, `useAuthStore` |
| 커스텀 훅 | `use` + 동사/명사 | `useVoiceChat.ts` |
| 엔티티 | PascalCase interface | `Member`, `AuthUser` |
| Supabase 함수 | camelCase | `loadMembers`, `addMember` |

## Supabase 호출 패턴

```ts
// stores에서만 supabase 직접 호출
const { data, error } = await supabase.from('members').select('*')

// Auth: useAuthStore 통해서만
const { user, isGuest } = useAuthStore()

// Realtime: channel 생성 → subscribe → track (Presence) or send (Broadcast)
const channel = supabase.channel('channel-name')
```

## 인증 & 권한 패턴

```ts
const { user, isGuest } = useAuthStore()
const isAdmin = user?.role === 'ROLE_ADMIN'

// 게스트: isGuest === true, user === null
// 일반 멤버: user.role === 'ROLE_USER'
// 관리자: user.role === 'ROLE_ADMIN'
```

## 다국어 (i18n)

- 모든 UI 텍스트는 `useTranslation()` 훅으로
- 언어 파일: `src/i18n/locales/ko.ts`, `vi.ts`, `en.ts`
- 키 추가 시 세 파일 모두 동시에 추가

## 검증 (순서대로 실행)

```bash
# 타입 체크
npx tsc --noEmit

# 빌드 (배포 전 필수)
npm run build

# 린트
npm run lint

# 테스트
npx vitest run
```

> **push 전 반드시 `npm run build` 통과 확인** — `tsc --noEmit` 통과해도 `tsc -b`(빌드)에서 실패 가능.

## 스타일 규칙

- Tailwind CSS v4 사용 — 하드코딩 색상 금지
- 디자인 토큰: `var(--color-brand)`, `var(--color-text-primary)`, `var(--color-bg-surface)` 등
- 다크모드: CSS 변수로 자동 처리 (별도 dark: 클래스 최소화)

## 주의사항

- `guild-chat-${Date.now()}` 패턴 사용 중 (ChatWidget) — Realtime 채널명 낭비, 추후 개선 필요
- 게스트 접근 시 UID/민감 정보는 `{!isGuest && ...}` 패턴으로 숨김
- WebRTC 음성채팅: `src/hooks/useVoiceChat.ts` — [[WebRTC P2P 음성채팅 (Supabase Realtime 시그널링)]] 참조
