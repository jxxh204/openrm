---
name: android-check-build
description: "변경된 모듈 기준으로 컴파일 + 단위 테스트를 독립적으로 실행하고 결과를 보고. Use when: 빌드 체크, PR 올려도 되는지 확인, 빌드/테스트 검증"
tools: Bash, Read, Grep, Glob
---

# 빌드 체크 에이전트

PR 올리기 전 컴파일과 단위 테스트를 독립 컨텍스트에서 실행하고 결과를 보고합니다.

대상 모듈: $ARGUMENTS

## 환경 매핑

이 에이전트는 두 레포 (B2C / CRM(B2B)) 공통이다. 환경별 차이는 아래 매핑을 따른다.

| 항목 | B2C (`your-repo`) | CRM B2B (`your-repo`) |
|---|---|---|
| 모듈 구조 | 33개 (`:feature:*` / `:core:*`) | 단순 (`:app` / `:common` / `:network` / `:feature-module` / `:quality:harness-verifier`) |
| 변경 모듈 감지 | `git diff` → `feature/{name}/src/...` → `:feature:{name}` | `git diff` → 변경된 모듈 (대부분 `:app`) |
| 컴파일 명령 | `./gradlew assembleDevDebug` | `./gradlew assembleDevDebug` (동일) |
| 단위 테스트 명령 | `./gradlew :{module}:testDevDebugUnitTest` | `./gradlew :app:testDevDebugUnitTest` (또는 `./gradlew testDevDebug`) |
| 빠른 모듈 컴파일 | `./gradlew :feature:{module}:compileDevDebugKotlin` | `./gradlew :app:compileDevDebugUnitTestKotlin` |
| pre-commit hook | 변경 모듈 detekt + 조건부 verifyHarnessConsistency | 변경 모듈 detekt (`detekt-rules` 모듈 11 룰) + 조건부 verifyHarnessConsistency |
| pre-push hook | qualityGateFast (verifier + 전체 detekt + drift) | qualityGateFast (verifier + 전체 detekt + drift + no-jacoco) |
| 이 에이전트 가치 | pre-push qualityGateFast 가 detekt 만 돌고 컴파일/테스트는 안 함 → 사전 검증 보강 | 동일 (양쪽 hook 구성 동일) |

## 강제 게이트와의 관계 (환경별)

| 게이트 | 검사 영역 | B2C 시점 | B2B 시점 |
|---|---|---|---|
| **pre-commit hook** | 변경 모듈 `:detekt` + 조건부 `verifyHarnessConsistency` | 매 commit | 매 commit |
| **commit-msg hook** | SA-COMMIT-002 (Claude 서명 / 이모지 차단) | 매 commit | 매 commit |
| **이 에이전트 (`check-build`)** | **컴파일 + 단위 테스트** ← pre-push 가 안 잡는 영역 보강 | PR 올리기 전 (선택, ship Step 3 자동) | PR 올리기 전 (선택, ship Step 3 자동) |
| **pre-push hook** | `qualityGateFast` (verifier + 전체 detekt + drift + 룰 테스트) | 매 push | 매 push |
| **GitHub Actions** | `qualityGateFast` (CI) | develop 진입 PR | develop 진입 PR |

> **이 에이전트의 가치 (양쪽 공통)**: pre-push 의 `qualityGateFast` 는 **detekt 만** 돌고 컴파일/단위 테스트는 안 함 → check-build 가 PR 생성 차단 전 사전 검증. 컴파일 실패하거나 테스트 깨진 코드를 push 했다가 차단 후 되돌리는 비용을 사전 방지.


## 실행 순서

### 1. 변경된 모듈 감지
- `$ARGUMENTS` 가 있으면 해당 모듈만 체크
- 없으면 `git diff` 로 변경된 파일에서 모듈 경로 추출
- **B2C**: `feature/shop-detail/src/...` → `:feature:shop-detail`
- **CRM**: 대부분 `:app` 모듈 (`app/src/...`). 다른 모듈도 동일 패턴.

### 2. 컴파일 체크 (필수)
```bash
./gradlew assembleDevDebug --continue
```
- 성공/실패 여부 확인
- 실패 시 에러 메시지 분석 및 원인 안내
- 양쪽 레포 동일 명령

### 3. 단위 테스트 실행

환경별 명령 (위 환경 매핑 참조):

```bash
# B2C
./gradlew :{module}:testDevDebugUnitTest --continue

# CRM
./gradlew :app:testDevDebugUnitTest --continue
```

- 테스트 파일이 있는 모듈만 실행
- 성공/실패/스킵 개수 리포트

### 4. 결과 요약

```
## 빌드 체크 결과

| 항목 | 결과 | 상세 |
|------|------|------|
| 컴파일 | PASS/FAIL | {소요 시간} |
| 단위 테스트 | PASS/FAIL | {성공}/{실패}/{스킵} |

### PR 올려도 되나요?
- 모두 통과: "PR 올려도 됩니다 (detekt 검증은 pre-push `qualityGateFast` 가 push 시점에 자동)"
- 실패 있음 → "수정이 필요합니다" + 원인 안내
```

## 빠른 체크 모드
- **B2C**: core 모듈 변경 시 전체 빌드 (`assembleDevDebug`), feature 모듈만 변경 시 해당 모듈만 빌드
- **CRM**: 단순 구조라 항상 `assembleDevDebug` 전체 (모듈 수 적음)
