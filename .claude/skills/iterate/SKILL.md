---
name: iterate
description: 태스크 상태·타입 체크·테스트 결과를 종합 분석해 다음 액션을 결정하고 iterate-log에 기록할 때 사용. "지금 어디까지 왔어", "다음 뭐 해야 해", "진척도"에 발동. 스택 무관.
---

# Iterate (스택 중립)

## 1. 상태 파악
`.tasks/backlog.md`·`in-progress.md`·`done.md`·`design/`, `CLAUDE.md` 모두 읽기.

## 2. 검증 실행
현 conventions의 `## 검증` 섹션 명령을 실행한다(스택별: 웹 `tsc --noEmit`+test / Flutter `flutter analyze`+`flutter test` / FastAPI `ruff`+`mypy`+`pytest`).

## 3. 현황 테이블
- 태스크: 완료/진행/잔여/진행률(%)
- 테스트: 통과/실패
- 타입 오류 목록

## 4. 다음 액션 결정
- **A 코드 버그**(타입/테스트 실패) → `/develop-task`로 수정
- **B 설계 불일치** → `/design-ui` 재설계
- **C 통과·잔여 있음** → 다음 P0 태스크 `/develop-task`
- **D 전부 완료** → conventions의 빌드 명령(웹 `npm run build` / Flutter `flutter build <타깃>` / FastAPI 배포 스모크) + 배포 체크리스트

## 5. 로그
`.tasks/iterate-log.md`에 누적:
```md
## YYYY-MM-DD HH:MM
- 진행률: N% · 타입오류: N · 테스트: 통과 N/실패 N
- 결정: Case X · 다음: …
```
