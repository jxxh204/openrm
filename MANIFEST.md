# 수록 목록 (MANIFEST)

에이전트 90 + 스킬 55. 회사 제품 라인 접두(b2b-/b2c-)를 제거하고 중복을 병합했으며, 회사·제품·도메인·개인 식별자를 제네릭/플레이스홀더로 치환했습니다(자동 스캔 0 검증).

## 에이전트 (90)

| 이름 | 설명 |
|---|---|
| `android-analyze-code` | CRM B2B Android 코드베이스를 격리 컨텍스트에서 탐색해 정리된 결과만 회수하는 단일 코드 분석 에이전트. mode 인자에 따라 module(ui 도메인/기능 패키지 정적 구조) / flow(키워드 기반 사용자 플로우 추적) / impact(백로그·요구사항… |
| `android-analyze-lite` | /b2b-android-epic Phase 4 백로그 컨펌 보조 에이전트 — 제안된 백로그 목록을 SA-Rule Registry(헌법 정합성) + 기존 BACKLOG_DB(중복) 에 대조해 위반/중복 후보를 격리 컨텍스트에서 분석·보고. Use when… |
| `android-build-healer` | Android 빌드/컴파일 실패를 분석하고 자동 수정하는 Healer 에이전트. AI-DLC Phase 4 build-healing 의 핵심 치유 단계. |
| `android-check-build` | 변경된 모듈 기준으로 컴파일 + 단위 테스트를 독립적으로 실행하고 결과를 보고. Use when: 빌드 체크, PR 올려도 되는지 확인, 빌드/테스트 검증 |
| `android-figma-policy-analyzer` | 피그마 디자인에서 정책·비즈니스 규칙·동작 조건·문구 등 비시각적 요소만 분석. CRM B2B Compose 디자인시스템 매핑까지 수행. Use when 피그마 화면의 상태 조건·입력 규칙·모달/토스트 동작·정확한 문구를 추출해야 할 때. |
| `android-figma-ui-analyzer` | 피그마 디자인에서 UI 배치, 컴포넌트, 디자인 토큰 매핑 등 시각적 요소만 분석. CRM B2B Compose 디자인시스템 (`compose/theme/`, `compose/component/`) 매핑까지 수행. Use when 피그마 화면의 레이아웃·프레임… |
| `android-issue-stale-checker` | GitHub 이슈 본문 + 생성일을 받아, 이슈에서 언급한 변경 대상(파일 경로 / 메서드 / 키워드)이 현재 코드/문서 상태와 비교해 이미 해결됐는지 판정. 격리 컨텍스트에서 Read + Grep + `git log -p` 수행 후 stale / valid 판정과… |
| `android-review-healer` | PR 리뷰 코멘트 자동 적용 후 lint/build/test 검증 실패 시 자율 보정하는 Healer 에이전트. AI-DLC Phase 6 review-healing 의 핵심 치유 단계. |
| `android-spec-compliance-reviewer` | 백로그 노션 카드의 요구사항(R1~Rn) 을 추출하여 변경 코드와 1:1 대조 후 PASS/MISSING/PARTIAL/EXTRA/AMBIGUOUS 5블록 판정. 코드 품질이 아닌 '스펙 준수' 만 검증 (Stage 1). /b2b-android-ship Step… |
| `android-tc-generator` | 다양한 입력 소스 기반 테스트 케이스(TC) 자동 생성 - 다중 출력 지원 |
| `android-ui-test-generator` | Android UI Automator E2E 테스트 코드 생성 |
| `android-ui-test-healer` | 실패한 Android E2E 테스트 자동 디버깅 및 수정 |
| `android-ui-test-planner` | Android UI 테스트 시나리오 기획 - 소스 코드 분석 기반 |
| `android-unit-test-runner` | 유닛 테스트(ViewModel, UseCase 등) 생성 → 실행 → 실패 수정 → 전체 통과까지 자율 수행. /b2b-android-ship Step 2 자동 위임 또는 명시 호출. 사용자 직접 호출 시엔 /b2b-android-unit-test 스킬 사용 권장… |
| `application-designer` | AI-DLC Inception 단계의 애플리케이션 설계 전문가. 정제된 요구사항을 받아 컴포넌트 설계, API 목록, 서비스 레이어 설계를 산출한다. |
| `backend-architect` | 최종 스펙을 기반으로 아키텍처를 설계하고, 레이어별 변경 계획을 수립하는 설계 전문가. 기존 코드 패턴을 존중하며 TASK 분리를 고려한 설계를 산출한다. |
| `backend-build-error-resolver` | 빌드 및 컴파일 에러 해결 |
| `backend-code-analyzer` | /api-test-plan 워크플로우 1단계 전용 (경량 모드). 브랜치 diff에서 변경 API/테이블/서비스/영향 범위 + API 호출 체인 도출. (워크플로우 단계 의미의 'Phase 1'이며, 산출물 ID 체계의 P0 와는 무관.) |
| `backend-code-feasibility-checker` | 코드베이스 대표(Codebase Representative). 코드베이스를 탐색하여 기획의 구현 가능성을 평가하고, 난이도·영향 범위·기존 정책 충돌을 개발자 관점에서 판단하는 전문가. |
| `backend-code-reviewer` | 품질, 보안 및 유지보수성을 위한 코드 리뷰 |
| `backend-cross-module-detector` | /api-test-plan 경량 모드 전용. 변경 모듈의 교차 호출 식별 및 키워드 보강. |
| `backend-cs-handler` | CS 운영 이슈 텍스트를 받아 ops 폴더에서 유사 패턴 매칭 → 컨텍스트 로드 → SQL/코드 작업 가이드. 고객 차트 복구·네이버 연동 해제·미등록 서브몰 반려·앱 팝업 타깃 등 반복 운영 패턴 자동화. |
| `backend-db-investigator` | DB 스키마, 인덱스, 테이블 관계를 조사하여 Entity-DB 매핑과 컬럼 특이사항을 보고하는 DB 조사 전문가. |
| `backend-deep-code-reviewer` | \| 독립 컨텍스트에서 변경 영향 범위 + 하위 호환성 중심 코드 심층 리뷰. 트리거: 심층 리뷰, 영향 범위 분석, breaking change 확인 |
| `backend-detail-weaver` | 2차 하네스(개발 설계) 디테일러 산출물 검증 판단자. 디테일러가 작성한 TASK별 구현 명세의 교차 TASK 정합성·설계서 참조 정확성·범위 경계 완결성을 교차 검증하고, 보강 필요 시 디테일러에게 재실행을 지시한다. 가디언(1차 정책)/센티넬(2차 아키)과 대칭… |
| `backend-e2e-runner` | E2E 테스트 작성 및 실행 |
| `backend-impact-analyzer` | 코드 변경 시 영향받는 파일과 범위를 추적하여 수정 누락(of/from 변환 메서드, 다른 API 영향, 모듈 경계 전파)을 방지하는 영향 범위 분석 전문가. |
| `backend-infra-mapper` | /api-test-plan Phase 3 전용. 변경 모듈을 AWS 인프라(로그 그룹, SSH)에 매핑. |
| `backend-layer-analyzer` | /api-test-plan 분산 모드 전용. 대규모 변경(20개+) 시 계층별(api/data/logic) 분담 분석. |
| `backend-pattern-researcher` | 기존 코드의 구현 패턴, 클래스 간 관계, 레이어 흐름을 조사하고 동일 도메인 비대칭(테이블/엔드포인트 불일치)을 표면화하는 패턴 조사 전문가. |
| `backend-perf-checker` | 쿼리 설계의 성능 리스크를 EXPLAIN/인덱스/N+1 관점에서 사전 점검하는 성능 검증 전문가. |
| `backend-plan-reviewer` | /api-test-plan Phase 4 전용. 테스트 플랜의 누락 시나리오/엣지케이스/모니터링 설정 검토. |
| `backend-planner` | 기능 및 작업 구현 계획 설계 |
| `backend-policy-checker` | 구현 방향이 정책/컨벤션/기존 비즈니스 룰과 충돌하지 않는지 검증하는 정책 검증 전문가. 확정 사항 준수와 미확정 항목 경고를 수행한다. |
| `backend-policy-reviewer` | 통합 검증자 + QA 루프 판단자(Integration Validator). 루나(정책)와 코드체커(코드) 산출물을 교차 검증하고, 재실행 필요 여부를 판단하여 오케스트레이터에 지시하는 품질 관문. |
| `backend-refactor-cleaner` | 코드 리팩토링 및 정리 |
| `backend-researcher` | 외부 API 스펙, 라이브러리 문서, 기술 제약사항을 조사하는 리서치 전문가. 외부 연동이 필요한 기획에서 선택적으로 호출된다. |
| `backend-scenario-builder` | /api-test-plan 워크플로우 2단계 전용 (오케스트레이터 호출). 코드 분석 결과 기반 Flow / X-IDs / E-IDs 시나리오 + 상태 전이 + 단계별 DB 검증 SQL 작성. |
| `backend-security-reviewer` | 보안 취약점 검사 전문가 |
| `backend-sentinel` | 2차 하네스(개발 설계) 전용 검증 판단자. 아키 산출물 + 시스템 엣지케이스를 교차 검증하고, 보강 필요 시 아키에게 재실행을 지시한다. 1차 하네스의 가디언과 대칭 구조. |
| `backend-spec-analyst` | 정책 대표(Policy Representative). 노션/피그마 기획서에서 정책을 빠짐없이 추출하고, 정확성·완전성·최신성을 책임지는 기획 분석 전문가. |
| `backend-spec-synthesizer` | 기획 분석, 코드 매핑, 정책 검토, 사용자 확인 결과를 종합하여 구현 가능한 최종 기획서를 산출하는 종합 전문가. |
| `backend-task-decomposer` | 아키텍처 설계를 독립적으로 병렬 실행 가능한 TASK 단위로 분해하는 작업 분해 전문가. 각 TASK는 단독으로 구현·테스트·PR 가능해야 한다. |
| `backend-task-detailer` | TASK 골격 문서를 구현 명세서 수준으로 고도화하는 전문가. 코드베이스를 심층 탐색하여 실제 구현 코드, 테스트 코드, 컨벤션 검증까지 수행한다. |
| `backend-tc-designer` | 정책 문서와 요구사항을 기반으로 테스트 케이스 목록을 설계한다. 데이터 쓰기를 동반하는 조회/필터에는 라이프사이클 표준 5질문을 강제 적용하는 TC 설계 전문가. |
| `backend-tdd-guide` | 테스트 주도 개발 가이드 |
| `backend-test-researcher` | 기존 테스트 패턴, 픽스처, 데이터 셋업 방식을 조사하여 TDD 시작 전 기존 패턴 파악을 돕는 테스트 조사 전문가. |
| `backend-test-verifier` | \| 테스트 코드를 실제 실행하여 컴파일/실행 가능성까지 검증하는 독립 검토. 트리거: 테스트 검증, 테스트 품질 확인 |
| `code-planner` | 구현 시작 전 기존 코드베이스를 분석하고 단계별 구현 체크리스트를 수립하는 계획 전문가. wiki 우선 탐색으로 토큰을 절약한다. |
| `code-simplifier` | 동작을 바꾸지 않고 불필요한 복잡도를 제거하는 코드 단순화 전문가. 구현 완료 후 가독성 개선에 사용한다. |
| `cross-domain-checker` | 멀티-도메인 시스템의 크로스-도메인 참조 무결성 검증 전문가. 설계·구현 변경이 다른 도메인에 미치는 영향과 누락 패턴을 검토한다. |
| `debugger` | 에러 메시지나 Sentry 이슈를 받아 원인을 진단하고 수정 방향을 도출하는 디버깅 전문가. wiki → 소스 드릴다운 순서로 탐색하며, 근본 원인 확인 후에만 수정을 제안한다. |
| `functional-designer` | AI-DLC Plan 단계의 기능 설계 전문가. 유닛별 비즈니스 로직을 상세 설계한다. |
| `incident-analyzer` | Sentry 이슈나 에러 본문을 받아 데이터 기반으로 장애 원인을 분석하고 대응 방안을 도출하는 전문가. |
| `ios-build-checker` | 앱 빌드(컴파일)를 실행하여 빌드 성공 여부를 확인하는 에이전트 |
| `ios-code-analyzer` | 기존 코드를 분석하고 요구사항 기반으로 개발 범위를 파악하는 에이전트 |
| `ios-code-implementer` | 일감 내용과 사전 분석 결과를 기반으로 코드를 구현하는 에이전트 |
| `ios-component-mapper` | 피그마 분석 결과와 참고 코드를 대조하여 프로젝트 컴포넌트 매핑을 확정하는 에이전트 |
| `ios-design-analyzer` | Figma 디자인을 분석하고 프로젝트 DesignSystem 토큰/컴포넌트에 매핑하는 디자인 분석 전문 에이전트입니다. Figma URL을 입력받아 디자인 요소를 추출하고, DesignSystem 모듈과 비교하여 매핑 테이블과 Gap 분석 결과를 제공합니다. |
| `ios-docs-reviewer` | 프로젝트 문서를 종합 검토하고 불일치/오류를 수정하는 문서 최신화 에이전트입니다. 스코프에 따라 단일 모드(경로/불일치 검출 및 수정)와 고도화 모드(3팀 병렬 7-기준 품질 평가 및 개선)를 자동 선택합니다. |
| `ios-feature-builder` | TCA Feature(State/Action/Reducer)와 Domain(UseCase/Model)을 구현하는 에이전트입니다. 작업 계획을 기반으로 비즈니스 로직 레이어를 생성합니다. |
| `ios-figma-policy-analyzer` | 피그마 디자인에서 정책, 비즈니스 규칙, 동작 조건 등 비시각적 요소를 분석하는 에이전트 |
| `ios-figma-ui-analyzer` | 피그마 디자인에서 UI 배치, 컴포넌트, 디자인 시스템 매핑 등 시각적 요소를 분석하는 에이전트 |
| `ios-git-reviewer` | 코드 리뷰, 커밋, PR 생성, PR 리뷰 반영을 담당하는 Git 워크플로우 에이전트입니다. 변경사항을 컨벤션에 맞게 검토하고, 커밋 메시지를 작성하고, PR을 생성/업데이트하고, 리뷰어 코멘트를 반영합니다. |
| `ios-implementation-verifier` | 구현된 코드가 피그마 스펙, 요구사항, Todo 체크리스트와 일치하는지 검증하는 에이전트 |
| `ios-issue-analyzer` | GitHub 이슈를 분석하여 노션 일감 초안을 구조화하는 전문 에이전트입니다. 이슈 본문에서 유형/링크/영향 범위를 파싱하고, 관련 코드를 탐색하여 ${TICKET_PREFIX} 카드 생성에 필요한 구조화된 데이터를 반환합니다. |
| `ios-network-builder` | API 네트워크 레이어(Router, Repository, DTO, MockData)를 구현하는 에이전트입니다. 작업 계획의 API 스펙을 기반으로 NetworkSystem 모듈에 필요한 파일을 생성합니다. |
| `ios-notion-analyzer` | 노션 문서(기획서, 회의록, PRD, 에픽 등)를 순차 분석하여 요구사항과 작업 범위를 정리하는 에이전트 |
| `ios-notion-writer` | b2b-ios-task-planner의 일감 정보를 받아 노션 페이지를 생성하는 에이전트 |
| `ios-planning-orchestrator` | Figma/이미지/설명을 받아 분석하고, 기획을 정리하여 Notion 일감을 생성하는 기획 오케스트레이터 에이전트입니다. 디자인 분석, 코드베이스 비교, Gap 분석을 수행한 후 일감을 분할하고, 각 일감의 작업 계획을 수립하여 Notion에 생성합니다. 기존… |
| `ios-side-effect-analyzer` | 코드 변경에 따른 사이드이펙트를 분석하는 에이전트 |
| `ios-side-effect-verifier` | 코드 구현 후 실제 사이드이펙트가 발생하지 않았는지 검증하는 에이전트 |
| `ios-slack-analyzer` | 슬랙 링크를 기반으로 관련 논의, 결정사항, 추가 맥락을 추출하는 에이전트 |
| `ios-task-executor` | 노션 일감을 읽고 구현부터 PR까지 전체 작업을 관리하는 오케스트레이터 에이전트 |
| `ios-task-planner` | 기획 자료(노션/슬랙/피그마)를 분석하여 구현 가능한 일감을 생성하는 오케스트레이터 + PO 에이전트 |
| `ios-test-builder` | 테스트 코드를 작성하는 에이전트입니다. TCA Feature 테스트(Swift Testing + TestStore), Repository/UseCase 테스트(XCTest + Combine)를 프로젝트 컨벤션에 맞게 생성하고, 커버리지 80% 이상을 목표로 합니다. |
| `ios-test-writer` | 구현된 코드에 대한 테스트 코드를 작성하고 실행하는 에이전트 |
| `ios-ui-builder` | SwiftUI View를 DesignSystem 컴포넌트와 토큰을 활용하여 구현하는 에이전트입니다. Figma 디자인 분석 결과를 기반으로 화면 UI를 생성합니다. |
| `kotlin-reviewer` | Kotlin/Spring Boot 코드 리뷰 전문가. 실제 발생한 반복 실수 패턴을 기반으로 검토한다. |
| `requirements-analyst` | AI-DLC Inception 단계의 요구사항 분석·정제 전문가. 기능 설명이나 사용자 요청을 받아 코드베이스 프로파일 기반으로 요구사항을 정제하고 outcome metric을 확인한다. |
| `ship-checklist` | 배포 전 최종 검증 체크리스트를 수행하는 에이전트. 모든 항목이 통과되어야 배포를 진행할 수 있다. |
| `spec-compliance-reviewer` | 구현 코드가 스펙(설계 문서, 요구사항, 태스크 정의)을 충족하는지 검증하는 리뷰어. 코드 품질이 아닌 스펙 준수 여부만 판단한다. |
| `spec-writer` | AI-DLC Spec 단계의 스펙 작성 전문가. units-generator 출력을 받아 유닛별 구현 가능한 상세 스펙(완료 기준 포함)을 확정한다. |
| `tester` | 구현 코드나 구현 계획을 받아 테스트 전략을 수립하고 테스트를 작성하는 전문가. 테스트 없이 구현 완료를 선언하지 않는다. |
| `typescript-reviewer` | TypeScript/React(Next.js) 프론트엔드 코드 리뷰 전문가. 실제 발생한 패턴을 기반으로 검토한다. |
| `units-generator` | AI-DLC Spec 단계의 유닛 분해 전문가. 기능 범위를 플랫폼별 독립 구현 유닛으로 분해한다. |
| `web-backlog-writer` | 디자인 인벤토리를 기반으로 Feature > Story > Task 계층의 백로그를 작성하는 전문가. 화면/컴포넌트/인터랙션 단위로 분해한다. |
| `web-design-analyzer` | Figma 디자인 데이터를 MCP로 추출하고, 화면/컴포넌트/인터랙션 인벤토리를 작성하는 전문가. Figma URL이 주어지면 디자인 구조를 파악한다. |
| `web-policy-auditor` | 디자인에서 Empty/Error/Loading state, 반응형, 접근성, 예외 흐름 등 정책 누락을 감사하는 전문가. 디자인 정책 갭을 식별한다. |
| `web-qa-reviewer` | 백로그, 정책 감사, 디자인 요청 산출물의 일관성과 누락 여부를 교차 검증하는 QA 전문가. |

## 스킬 (55)

| 이름 | 설명 |
|---|---|
| `a11y-check` | React/Next.js 컴포넌트의 웹 접근성(WCAG 2.1 AA)을 자동 검증한다. 시맨틱 HTML, ARIA, 키보드 탐색, 색상 대비를 점검한다. |
| `api-integration` | 여러 Notion API 문서를 프론트에 반영하는 작업. Notion/Swagger/로컬 DTO 3-way 대조로 불일치를 자동 탐지하고 구현·테스트 계획까지 산출. /api-integration 실행 시 활성화. user-invocable: true |
| `backlog-writer` | 디자인 인벤토리를 Feature > Story > Task 계층으로 분해하여 개발 백로그를 작성한다. 화면/컴포넌트/인터랙션 단위로 분해하고, 퍼블리싱/API/로직 Task를 분리. figma-to-backlog 하네스의 Phase 2 에이전트가 사용. |
| `business-domain` | ${PRODUCT} CRM B2B 웹 서비스의 비즈니스 도메인 배경 지식. 항상 참조되어 도메인 이해도를 높임. user-invocable: false |
| `commit-splitter` | 백로그 항목별 커밋 분리 전문가. 퍼블리싱/API 분리, 점진적 파일 빌드, 선택적 스테이징을 수행. /split-commits 커맨드 실행 시 자동으로 참조됨. allowed-tools: Read, Glob, Grep, Write, Edit, Bash |
| `create-commit` | 변경사항을 자동으로 분석하고 프로젝트 커밋 룰에 따라 커밋 생성 |
| `create-common-component` | (설명 없음) |
| `create-domain-feature` | 도메인 기반 폴더 구조로 기능 생성 (FOLDER_STRUCTURE_CONVENTIONS.md 기반) argument-hint: [도메인명/기능명] allowed-tools: [read, write, bash, edit, glob] |
| `create-e2e-test` | E2E 테스트 파일 자동 생성 (Given-When-Then 스타일) argument-hint: [기능명] allowed-tools: [read, write, grep, bash, edit] |
| `create-integration-test` | 프로젝트 맞춤형 통합 테스트 파일 자동 생성 (INTEGRATION_TESTING_RULES.md 기반) argument-hint: [컴포넌트경로] allowed-tools: [read, write, grep, bash, edit, multi-edit] |
| `create-pr` | GitLab Flow 기반 PR 생성 자동화 (대화형 템플릿) argument-hint: [base-branch] [head-branch] allowed-tools: [bash, read, write, edit, multi_edit, grep, glob, ls] |
| `create-unit-test` | 프로젝트 맞춤형 단위 테스트 파일 자동 생성 (UNIT_TESTING_RULES.md 기반) argument-hint: [파일경로] allowed-tools: [read, write, grep, bash, edit] |
| `design-analyzer` | Figma MCP로 디자인 데이터를 추출하고, 화면/컴포넌트/인터랙션 인벤토리를 작성한다. Figma URL이 주어지면 디자인 구조를 파악. figma-to-backlog 하네스의 Phase 1 에이전트가 사용. |
| `execute-domain-migration` | 레거시(`src/containers` 등) → 도메인(`src/domains/{domain}/`) 폴더 구조 마이그레이션을 실행한다. 페이지와 의존 자산 전체를 이전하고 import 경로를 일괄 치환. 본 스킬은 실행용 — 결과 점검은 별개 스킬… |
| `figma-design-audit` | 노션 일감의 Figma 노드 ID 기준으로 구현 코드를 디자인과 픽셀 단위로 비교·검수·수정하는 워크플로우. 디자인 검수해줘, Figma랑 비교해서 고쳐줘, 디자인이랑 달라, {노션 일감 URL} 픽셀 일치 요청 시 트리거. |
| `figma-implementation-plan` | 노션 에픽/일감 묶음과 Figma 디자인, 코드베이스 패턴을 분석해 즉시 실행 가능한 일감별 구현 계획서를 산출하는 워크플로우. 계획서 만들어줘, 에픽 분석해줘, {에픽 URL} 일감 진행 계획, 노션 일감 본문 보강 요청 시 트리거. |
| `figma-to-backlog` | Figma 디자인 URL로부터 개발 백로그(backlog.md), 정책 누락 보고서(policy-gaps.md), 디자이너 요청 목록(design-requests.md)을 자동 생성하는 오케스트레이터. 'Figma에서 백로그 추출', '디자인 분석해서 백로그… |
| `find-skills` | Helps users discover and install agent skills when they ask questions like how do I do X, find a skill for X, is there a skill that can..., or… |
| `folder-structure` | 도메인 기반 폴더 구조와 3Depth 추상화 레벨 규칙. 컴포넌트나 페이지 생성 요청 시 자동으로 참조됨. user-invocable: false |
| `frontend-design` | 프론트엔드 UI 컴포넌트를 디자인하고 구현합니다. React, Vue, HTML/CSS 등 다양한 프레임워크를 지원합니다. |
| `generate-backlog-branch` | (설명 없음) |
| `generate-migration-backlog` | 도메인 마이그레이션 노션 일감을 자동 생성하거나 기존 일감을 재작업용으로 정리한다. 부모 일감(에픽) URL을 받아 연관 백로그로 등록하고 본문 템플릿을 자동으로 채운다. user-invocable: true argument-hint: {create… |
| `hydration-debugger` | Next.js SSR/SSG 경계 이슈와 hydration mismatch를 디버깅한다. 서버/클라이언트 코드 분리, 동적 import, 환경별 렌더링 차이를 진단한다. |
| `impact-analysis` | 기능 활성화/변경 시 서비스 전반의 정책적·비즈니스적 영향도를 분석. 코드+정책+도메인 교차 분석으로 숨겨진 연쇄 영향과 리스크를 탐지. /impact-analysis 실행 시 활성화. user-invocable: true |
| `karpathy-guidelines` | Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical… |
| `marty-additional-task` | 추가업무(애드혹 작업) 엔드투엔드 스킬. 개발자가 자유 텍스트로 업무를 설명하면 ① 노션 백로그 생성 → ② 격리 워크트리 → ③ 개발(코드·테스트·셀프리뷰) → ④ PR draft 까지 끝낸다. 진행 중 추가업무 현황 보드(board.json)에… |
| `marty-agent-status` | 모든 sub-agent의 현재 상황을 한눈에 보고. lead가 각 cmux/tmux 에이전트의 실시간 상태(🟢작업중/🟡차단/⚪대기)·현재 작업·PR·마지막 출력을 tmux pane + state.json에서 즉시 취합한다. 개발자가 현재 상황, 현황, 지금 뭐하고… |
| `marty-backlog-dashboard` | 백로그 진행 현황판 빌더. state.json `currentAgents` + `backlogs[]`를 source로 4 컬럼 칸반 형태 HTML 대시보드 생성. 30s 폴링 자동 갱신, dev/storybook 포트 라이브 상태, 노션/PR/cmux 링크 통합.… |
| `marty-backlog-execute` | 단일 노션 백로그 URL을 받아 컨텍스트 수집 → plan.md → 자율도 판정 → 코드 → 테스트 → 셀프리뷰 → PR draft까지 결정론적 state machine으로 진행한다. 각 state에서 정해진 액션만 실행하며, drift(즉흥 추상화/스코프 확장)… |
| `marty-bootstrap-feature-workflow` | 새 feature 워크플로우 셋업 자동화. state.json 초안 생성 + tmux 세션 매핑 + 대시보드 빌더 등록 + cmux workspace 안내. 처음 feature 시작 시 또는 팀원이 새 프로젝트에 워크플로우 적용 시 트리거.… |
| `marty-epic-workflow` | 큰 프로젝트 병렬 개발 워크플로우. epic > feature(page) > backlog 3-tier 구조로 여러 페이지를 워크트리 단위 병렬 진행. .workflow/state.json 존재 시 자동 활성화. /epic-workflow 슬래시 커맨드로 셋업.… |
| `marty-figma-review-loop` | PR을 Figma 기준 완성도 100%까지 끌어올리는 self-review 루프. figma-pr-reviewer 에이전트(브라우저 실측+코드 리뷰)로 채점 → 갭을 구현 워커에 라우팅 → 워커 수정·push → 재리뷰 → 100%(또는 개발자 중단)까지 반복.… |
| `marty-setup-review-environment` | 리뷰대기 백로그 검증 환경 자동 셋업. 각 에이전트 워크트리의 tmux 세션에 yarn dev + yarn storybook 기동, 관련 OPEN PR을 브라우저로 자동 오픈. 개발자가 리뷰 검증 환경 띄워줘, 스토리북/개발서버 켜줘, 백로그 검증 시작 등 요청 시… |
| `marty-workflow` | 워크플로우 단일 진입점 — cmux/tmux/dashboard/dev/storybook/progress loop/agent 환경 1줄 점검·복원. 개발자가 cmux 재기동 후 또는 새 lead 세션 시작 시 발화 (SessionStart hook이 자동 호출). 명시… |
| `migration-workflow` | 도메인 마이그레이션을 처음부터 끝까지 자동 진행하는 오케스트레이터(일감 정리 → 코드 이동 → 검증 게이트 → PR 생성). Customer/Book/Sales 등 도메인 마이그레이션해줘, 마이그레이션 다시 진행, 재작업, {부모URL}에 도메인 마이그레이션 일감,… |
| `playwright-cli` | Automate browser interactions, test web pages and work with Playwright tests. allowed-tools: Bash(playwright-cli:*) Bash(npx:*) Bash(npm:*) |
| `policy-auditor` | 디자인의 Empty/Error/Loading state, 반응형, 접근성, 예외 흐름 등 정책 누락을 감사한다. 화면별 5가지 상태 체크, WCAG 2.1 AA 기준 접근성 감사. figma-to-backlog 하네스의 Phase 2 에이전트가 사용. |
| `qa-reviewer` | 백로그, 정책 감사, 디자인 요청 산출물의 일관성과 누락 여부를 교차 검증한다. 인벤토리 <-> 백로그 커버리지, 정책 Gap <-> 백로그 반영, 용어 일관성을 검증. figma-to-backlog 하네스의 Phase 3 에이전트가 사용. |
| `qa-tc-unify` | 정기 릴리스 등 여러 티켓의 QA 테스트케이스(TC)를 하나의 노션 통합 DB로 모으고, Figma 네임 기반 Feature 그룹핑·Figma 프레임 URL 매핑·개발언어 제거 리팩터링까지 수행하는 워크플로우. 정기 릴리스 QA TC 통합, 여러 티켓 TC 하나로… |
| `report-migration-result` | 도메인 마이그레이션 종합 검증 결과(`yarn verify:migration:full --json`)를 받아 노션 일감의 검증 리포트 섹션과 PR 본문(`.github/pull_request_template.md` 기반)을 자동 합성한다. Customer… |
| `resolve-icon` | (설명 없음) |
| `resolve-issue` | 이슈 해결 워크플로우: 백로그 생성 > 브랜치/워크트리 > 작업 > PR (end-to-end) argument-hint: [Slack 스레드 링크 또는 이슈 제목] allowed-tools: [bash, read, write, edit, multi_edit,… |
| `review-api` | Notion API 문서를 입력받아 사용처/타입/변경점/정책 영향도/잠재 이슈를 종합 분석. /review-api 실행 시 활성화. user-invocable: true |
| `review-pr` | 오픈된 PR 코드 리뷰 자동 분석 및 제출 (P1/P2/P3 우선순위 기반) |
| `shared-finishing-branch` | 구현 완료 후 브랜치를 마무리할 때 사용한다. 테스트 검증 → 환경 감지 → 옵션 제시 → 실행 → 정리까지 안내한다. |
| `shared-receiving-code-review` | 코드 리뷰 피드백을 받았을 때 사용한다. 기술적 검증 후 구현하며, 동의 연기(performative agreement)나 무비판적 수용을 금지한다. |
| `shared-skill-authoring-guide` | 새로운 스킬을 작성하거나 기존 스킬을 개선할 때 사용한다. 프론트매터 표준, Progressive Disclosure 패턴, 작성 규칙을 안내한다. |
| `shared-spec-self-review` | 구현 완료 후 코드 리뷰 요청 전에 사용한다. 스펙(설계 문서, 태스크 정의)과 구현 코드를 스스로 대조하여 누락·불일치를 먼저 잡는다. |
| `shared-systematic-debugging` | 버그, 테스트 실패, 예기치 않은 동작을 만났을 때 수정을 시도하기 전에 사용한다. 근본 원인을 먼저 찾고, 그 다음에 수정한다. |
| `shared-verification-before-completion` | 작업 완료, 수정 완료, 테스트 통과를 주장하기 전에 반드시 검증 명령을 실행하고 출력을 확인한 후에만 결과를 보고한다. 커밋/PR 생성 전 필수 적용. |
| `skill-creator` | Claude Code 스킬을 자동으로 생성하는 메타 스킬. 스킬 구조, 프론트매터, 설명 최적화를 도와줍니다. |
| `slack-to-pr` | 슬랙 스레드 → 노션 백로그 생성 → 코드 수정 → PR 생성 전체 자동화 argument-hint: <slack-thread-url> |
| `type-conventions` | TypeScript에서 interface와 type의 사용 기준. 타입 정의 시 자동으로 참조됨. user-invocable: false |
| `verify-domain-migration` | 레거시 → 도메인(`src/domains/*`) 마이그레이션이 컨벤션·경계·동작 측면에서 올바른지 점검하는 검증 스킬. 마이그레이션 PR 자체 점검과 단계별(Stage 1~3) 검증에 사용. 실행은 별개 스킬 `execute-domain-migration` 사용.… |
| `workflow-harness` | 워크플로우 Full-Auto 하네스. 전 Phase 권한 프리셋, 자동 체인, 퍼블리싱 검증 루프. `/workflow start --auto` 시 활성화. user-invocable: false |
