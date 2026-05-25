# Web Push 알림 설정 가이드

이주 신청이 접수되면 관리자에게 푸시 알림이 가도록 하는 기능. 1회만 설정하면 됩니다.

## 0. 빌드/배포된 코드 확인

- 클라이언트: 알림 토글 버튼이 `이주 신청 관리` 페이지 상단에 노출됨
- 서버: Vercel Serverless Function `/api/push/transfer` 배포됨

## 1. Supabase: 마이그레이션 실행

Supabase Dashboard → SQL Editor 에서 실행:

```
supabase/migration_push_subscriptions.sql
```

## 2. Vercel: 환경변수 등록

Vercel Dashboard → Project → **Settings → Environment Variables** 에 4개 등록:

| 키 | 값 | 비고 |
|----|----|------|
| `VAPID_PRIVATE_KEY` | `yFBmm50rOwQA-3wcDwb6Q8sZ-HF7YWOZGj9Fy4d1HDg` | (이미 생성된 키) |
| `VAPID_SUBJECT` | `mailto:admin@onedarkwar.app` | 본인 이메일로 |
| `PUSH_WEBHOOK_SECRET` | 임의의 랜덤 문자열 (예: `openssl rand -hex 32` 결과) | Supabase webhook 헤더와 일치해야 함 |
| `SUPABASE_URL` | `https://your-project-id.supabase.co` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | (service_role 키) | Supabase Dashboard → Settings → API → service_role secret |

등록 후 **Redeploy** 한 번 필요 (또는 다음 push 시 자동 적용).

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` 는 RLS 우회 권한이라 절대 클라이언트에 노출되면 안 됨. Vercel env (Server-side) 에만.

## 3. Supabase: Database Webhook 설정

Supabase Dashboard → **Database → Webhooks → Create new webhook**:

- **Name**: `transfer-push`
- **Table**: `transfer_applications`
- **Events**: ✅ Insert (체크)
- **Type**: HTTP Request
- **HTTP Method**: POST
- **URL**: `https://<your-vercel-domain>/api/push/transfer`
  (예: `https://one-darkwar.vercel.app/api/push/transfer`)
- **HTTP Headers**:
  - `Content-Type`: `application/json`
  - `x-webhook-secret`: 위에서 만든 `PUSH_WEBHOOK_SECRET` 와 **동일한 값**

저장.

## 4. 관리자 디바이스에서 알림 켜기

1. 관리자 계정으로 로그인
2. **이주 신청 관리** 페이지 진입
3. 우상단 **"알림 OFF"** 버튼 클릭 → 권한 요청 팝업 허용 → **"알림 ON"** 으로 변경
4. 토스트 메시지 "새 이주 신청이 오면 알림을 받습니다" 확인

여러 디바이스(PC, 모바일 PWA 등)에서 각각 따로 켜야 합니다.

## 5. 테스트

게스트 모드로 이주 신청 폼 제출 → 관리자 디바이스에 알림 표시.

알림 클릭 시 자동으로 `/transfer` 페이지로 이동.

## 트러블슈팅

- **알림 토글 버튼이 안 보임**: 브라우저가 Web Push 미지원 (iOS 16.4 미만, 인앱 브라우저 등). iOS 는 홈 화면 추가 필수.
- **버튼은 있는데 알림 안 옴**: Webhook URL 오타 또는 secret 불일치. Supabase Webhook 의 **Logs** 탭에서 응답 확인.
- **401 Unauthorized**: secret 불일치. Vercel env 와 Supabase webhook header 값을 다시 비교.
- **500 Server misconfigured**: Vercel env 누락. `VAPID_PRIVATE_KEY` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 다시 확인.
- **알림 권한 거부 후 다시 켜고 싶음**: 브라우저 사이트 설정에서 알림 권한 리셋 → 다시 토글.
- **iOS PWA 에서 안 보임**: iOS 는 반드시 "홈 화면에 추가" 한 PWA 에서만 동작. Safari 일반 탭에선 불가.

## 운영

- 구독이 만료(410/404)된 endpoint 는 발송 시 자동으로 DB 에서 정리됨
- 구독 끄려면 같은 토글 버튼을 다시 누름 (브라우저 권한 + DB 둘 다 정리)
