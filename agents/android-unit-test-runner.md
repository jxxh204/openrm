---
name: android-unit-test-runner
description: "유닛 테스트(ViewModel, UseCase 등) 생성 → 실행 → 실패 수정 → 전체 통과까지 자율 수행. /b2b-android-ship Step 2 자동 위임 또는 명시 호출. 사용자 직접 호출 시엔 /b2b-android-unit-test 스킬 사용 권장 (인터랙티브)."
tools: Bash, Read, Write, Edit, Grep, Glob
---

# 유닛 테스트 러너 에이전트 (Skill Delegate)

> **이름 충돌 해소**: 이전엔 `name: unit-test` 였으나 `/b2b-android-unit-test` 스킬과 동명으로 호출처 식별이 헷갈려 `unit-test-runner` 로 분리. 본문 절차는 `/b2b-android-unit-test` 스킬과 동일.

본 에이전트는 [`/b2b-android-unit-test` skill](../skills/unit-test/SKILL.md) 본문을 그대로 따른다. 같은 본문을 두 곳에 두면 단일 진실 원칙이 깨지므로, **이 파일은 호출 인터페이스만** 제공하고 절차·규칙·환경 매핑은 모두 위 skill SKILL.md 를 참조한다.

대상: $ARGUMENTS

## 동작

`.claude/skills/unit-test/SKILL.md` 를 Read 한 뒤 그 본문의 모든 단계 (Phase 0~4) 와 규칙을 따라 작업한다. 추가로 적용할 사항은 없다.

## 왜 agent 와 skill 이 분리되어 있나

- **Skill (`/b2b-android-unit-test`)**: 사용자가 슬래시 명령으로 직접 호출하는 정문. 메인 컨텍스트에서 실행.
- **Agent (이 파일)**: 다른 스킬 (예: `ship` Step 2) 이 `Agent` tool 로 위임할 때 사용. **격리된 별도 컨텍스트**에서 실행되므로 호출 스킬의 메인 컨텍스트가 ViewModel 분석 / 빌드 로그로 오염되지 않는다.

두 인터페이스를 모두 지원하되, 본문은 단일 (SKILL.md) 로 유지한다.
