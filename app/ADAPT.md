# 셀프 적응이 필요한 부분

이 코어 릴리스는 자동 스캔 기준 회사·제품·인프라 식별자(사내 도메인·Notion DB ID·Slack 채널 ID·GitHub org 등)를 제거했지만, 아래 두 가지는 자동 스크럽으로 완전히 없애기 어려워 남겨둔 부분입니다. 동작에는 지장 없지만 다른 사람이 그대로 쓰면 어색할 수 있어 문서로 남깁니다.

## 1. "마티" — 원작자 이름이 UI/프롬프트에 하드코딩됨

원본 MRM은 "나(운영자)를 관리하는 서비스"라는 컨셉이라, 지휘자·리뷰어·백로그 담당자 이름으로 원작자의 닉네임("마티")이 아래 파일들에 40여 곳 박혀 있습니다.

- `server/orch.cjs`, `server/tasks.cjs`, `server/index.cjs`
- `src/components/ConductorConsole.tsx`, `src/pages/SessionsPage.tsx`

예: `REVIEW_DIRECTIVE`(tasks.cjs) — "마티가 이 변경을 직접 리뷰해" 같은 AI 프롬프트 지시문. 자기 이름으로 바꾸거나, 필요하면 환경변수(`MRM_OPERATOR_NAME` 같은)로 추출하는 리팩터를 권장합니다. 지금은 그대로 두면 AI가 "마티"를 대상으로 리뷰 브리핑을 씁니다.

## 2. 원본에서 제외된 기능 (사내 인프라 결합)

아래는 이번 코어 릴리스에서 빠졌습니다. 서버 모듈은 스텁(무해한 비활성 응답)으로 남아있어 앱이 깨지진 않지만, 기능은 안 됩니다.

| 기능 | 원본 모듈 | 이유 |
|---|---|---|
| AWS MFA 세션 갱신 | `aws.cjs` | 특정 AWS 프로필 구조 결합 |
| 원격 dev서버 자동로그인 | `devusers.cjs`, `preview.cjs` | 사내 로그인 프로토콜(2단계 쿠키) 결합 |
| 웹뷰 디버깅(CommandPage) | `webviewdbg.js`, `picker.js`, `elementctx.cjs` | 모바일 하이브리드 앱 특화 |
| GTM 태그 인벤토리 | `gtm.cjs` | 사내 마케팅 태깅 컨벤션 결합 |
| PPT 제작(Notion+Slides) | `ppt.cjs` | 사내 프레젠테이션 워크플로우 |
| cmux 세션 멀티플렉서 제어 | `cmux.cjs` | cmux 자체가 비공개 사내 도구 (터미널은 `term.cjs`가 순정 tmux로 대체 제공) |

직접 필요하면 각 스텁 파일(`server/*.cjs`)을 자기 인프라에 맞게 다시 구현하면 됩니다 — export 시그니처는 그대로 유지돼 있어 `index.cjs` 쪽 수정 없이 갈아끼울 수 있습니다.
