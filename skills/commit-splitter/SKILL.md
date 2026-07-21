---
name: commit-splitter
description: 백로그 항목별 커밋 분리 전문가. 퍼블리싱/API 분리, 점진적 파일 빌드, 선택적 스테이징을 수행. /split-commits 커맨드 실행 시 자동으로 참조됨.
allowed-tools: Read, Glob, Grep, Write, Edit, Bash
---

# Commit Splitter

백로그 항목 순서에 맞춰 working tree 변경사항을 여러 커밋으로 분리하는 전문 스킬.

## When to Use

- `/split-commits` 커맨드 실행 시
- "커밋 분리", "백로그별 커밋", "PR 분리" 키워드 감지 시
- 하나의 작업 브랜치를 여러 PR/커밋으로 나눌 때

## Core Concepts

### 1. 퍼블리싱 vs API 분리 원칙

**퍼블리싱 커밋** (UI만):
- API 호출 코드를 mock 데이터로 대체
- `TODO: [백로그명] api 연동 시 mock 데이터 제거` 주석 필수
- React Query, API import 제거
- useState로 mock 상태 관리

**API 연동 커밋**:
- mock 데이터를 실제 API 호출로 교체
- TODO 주석 제거
- React Query hook, API import 추가

### 2. 점진적 파일 빌드 (Progressive File Building)

새 파일이 여러 커밋에 걸쳐 기능이 추가되는 경우:

```
Commit 1: ComponentA (SectionSelect만 포함)
Commit 2: ComponentA (+ PeriodDatePicker 추가)
Commit 3: ComponentA (+ ReasonInput 추가)
Commit 4: ComponentA (+ PeriodSettingList 추가)
Commit 5: ComponentA (+ API 연동)
Commit 6: ComponentA (+ 저장 기능) ← 최종 버전
```

**규칙:**
- 각 커밋의 파일은 **독립적으로 컴파일 가능**해야 함
- 미사용 import/변수 없어야 함 (lint 통과)
- 이후 커밋에서 추가될 기능은 빈 wrapper나 placeholder로 표현

### 3. Mock 데이터 패턴

```tsx
// TODO: [기능명] api 연동 시 mock 데이터 제거
const MOCK_OPTIONS = [
  { name: '항목1', value: 1 },
  { name: '항목2', value: 2 },
]

// TODO: [기능명] api 연동 시 실제 데이터로 교체
const [selectedValue, setSelectedValue] = useState<number | null>(MOCK_OPTIONS[0].value)
```

### 4. 파일-커밋 매핑 전략

| 파일 상태 | 매핑 방법 |
|-----------|----------|
| **NEW** (공통 컴포넌트) | 해당 기능의 퍼블리싱 커밋에 포함 |
| **NEW** (도메인 컴포넌트) | 점진적 빌드 — 커밋마다 기능 추가 |
| **MODIFIED** | 변경 내용에 따라 해당 커밋에 포함 |
| **DELETED** | 대체 파일이 준비된 커밋에서 삭제 |

### 5. 커밋 순서 결정 기준

1. **공통 컴포넌트가 먼저** → 이를 사용하는 도메인 컴포넌트가 나중
2. **퍼블리싱이 먼저** → API 연동이 나중
3. **조회 API가 먼저** → 저장/수정 API가 나중
4. **의존성 순서** → A가 B를 import하면 A가 먼저

## Staging Workflow

### 단계별 실행 흐름

```
[분석] → [계획] → [반복: 스테이징 → 유저 커밋 → 브랜치 생성]
```

#### 분석 단계
1. `git status`로 전체 변경사항 파악
2. 변경 파일을 카테고리별 분류:
   - 공통 컴포넌트 (common/)
   - 도메인 컴포넌트
   - 스타일 파일
   - 타입 파일
   - Hook 파일
   - 삭제 파일

#### 계획 단계
1. 백로그 항목과 파일 매핑 테이블 생성
2. 점진적 빌드 필요 파일 식별
3. 퍼블리싱/API 분리 대상 식별
4. 커밋 순서 확정 후 사용자 확인

#### 실행 단계 (커밋당)
1. 해당 커밋의 파일 버전 작성 (점진적 빌드 대상)
2. mock 데이터 적용 (퍼블리싱 커밋인 경우)
3. `git add` 으로 스테이징
4. `git status`로 스테이징 상태 확인
5. 사용자에게 커밋 준비 완료 알림
6. 사용자가 커밋 & PR 완료 후 다음 브랜치 생성

## File Version Management

점진적 빌드 시 파일 버전 관리:

```
최종 파일 (working tree)
  ↓ 분석
버전 1 (Commit 1용) — 최소 기능
버전 2 (Commit 2용) — 기능 추가
  ...
버전 N (최종 Commit) — 전체 기능
```

**버전 작성 원칙:**
- 최종 파일을 기준으로 각 버전에 필요한 코드만 추출
- 각 버전은 lint/tsc 통과 필수
- import는 실제 사용하는 것만 포함
- 사용하지 않는 state/handler/memo 제거

## Branch Naming

커밋 간 브랜치 생성 규칙:
- 형식: `${TICKET_PREFIX}-{id}-[영문-기능-설명]`
- 이전 커밋의 브랜치에서 분기
- `git checkout -b [새브랜치] [이전브랜치]`

## Checklist

각 커밋 스테이징 전 확인:
- [ ] 해당 커밋의 파일만 스테이징되었는가?
- [ ] 점진적 빌드 파일이 현재 커밋에 맞는 버전인가?
- [ ] 퍼블리싱 커밋에 API 호출 코드가 없는가?
- [ ] mock 데이터에 TODO 주석이 있는가?
- [ ] 미사용 import/변수가 없는가?
- [ ] 각 파일이 독립적으로 컴파일 가능한가?
- [ ] 커밋 메시지 형식: `feat(${TICKET_PREFIX}-XXXXX): 설명`

## Output Format

각 커밋 스테이징 완료 시:

```markdown
## Commit N 스테이징 완료

**커밋명**: `feat(${TICKET_PREFIX}-XXXXX): 설명`
**브랜치**: `${TICKET_PREFIX}-XXXXX-branch-name`

### 스테이징된 파일
| 상태 | 파일 |
|------|------|
| NEW | `path/to/file.tsx` |
| MODIFIED | `path/to/other.tsx` |

### 점진적 빌드 파일
- `Component/index.tsx` — 이 커밋: SectionSelect만 / 최종: 전체 기능

### Mock 데이터 적용
- `MOCK_STAFF_OPTIONS` → TODO: api 연동 시 교체

### 다음 단계
커밋 후 알려주세요. 다음 브랜치를 생성하겠습니다.
```