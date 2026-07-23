# OpenRM App

> 여러 git 워크트리에서 동시에 돌아가는 AI 에이전트(Claude Code 등)를 한 화면에서 감시·지시하는 병렬 개발 관제탑.

![license](https://img.shields.io/badge/license-MIT-blue)

이 폴더는 [OpenRM](../README.md) 모노레포의 앱(Vite+Node 풀스택)입니다. 같은 리포 상위의 [`agents/`](../agents)·[`skills/`](../skills)가 "무엇을 하는가"의 엔진(Claude Code용)이라면, 이 앱은 "그 작업들이 지금 어떤 상태인가"를 보여주는 관제탑입니다.

## 이게 뭐예요?

여러 브랜치/워크트리에서 AI 에이전트를 병렬로 돌리며 개발하다 보면, "지금 뭐가 어디까지 됐는지" 파악하는 것 자체가 일이 됩니다. OpenRM App은 대상 레포의 워크플로우 상태(`state.json`) + 실시간 tmux/git/GitHub 상태를 읽어 하나의 대시보드로 보여주고, 터미널·PR·테스트·의존성 그래프까지 같은 화면에서 다룰 수 있게 합니다.

## 설치 & 실행 (설정 없이 바로 동작)

```bash
git clone https://github.com/jxxh204/openrm
cd openrm/app
npm install

# 터미널 1 — 백엔드
npm run server      # http://localhost:8770

# 터미널 2 — 프론트
npm run dev          # http://localhost:5180
```

`REPO_PATH`를 지정하지 않으면 **데모 모드**로 뜹니다 — 이 앱 자신을 대상 레포로 삼고, 번들된 가짜 백로그/에이전트 데이터(`demo/state.json`)로 화면 전체를 바로 확인할 수 있습니다.

## 진짜 레포에 연결하기

```bash
REPO_PATH=/path/to/your/repo npm run server
```

OpenRM App은 대상 레포의 `.docs/workflow/<feature>/state.json`에서 백로그·에이전트 상태를 읽습니다. 이 형식은 [`../skills`](../skills)의 `marty-workflow`/`backlog-execute` 계열 스킬이 실제로 만들어내는 산출물과 같은 스키마입니다 — 둘을 함께 쓰면 "AI가 작업 → state.json 갱신 → OpenRM App이 실시간 반영"이 자연스럽게 이어집니다. 워크트리 플릿·내 PR·테스트 현황 같은 페이지는 `state.json` 없이도(REPO_PATH만으로) 바로 동작합니다.

## 구조

```
openrm/
├── agents/, skills/      # 엔진 (Claude Code용, 상위 README 참고)
└── app/                  # ← 여기
    ├── server/           # 백엔드 (Node, 의존성 0) — 대상 레포를 읽어 정규화
    │   ├── index.cjs     #   HTTP + SSE 실시간 푸시 + 폴러
    │   └── collector.cjs #   state.json → read-model (REPO_PATH 없으면 demo/state.json 폴백)
    ├── demo/state.json   # REPO_PATH 미설정 시 쓰이는 데모 데이터
    ├── src/               # 프론트엔드 (React CSR, Vite + TS)
    ├── vite.config.ts    # 5180 → 백엔드 8770 프록시
    └── config.example.sh # 전체 설정 항목(선택)
```

## 뭐가 들어있나

| 페이지 | 하는 일 |
|---|---|
| 📋 감시 | 대상 레포의 백로그/에이전트 상태를 레인(계획→진행→리뷰→보류→완료)으로 |
| 🧑‍💻 개발실 | 워크트리별 실제 터미널(tmux+node-pty) — 여러 에이전트 동시에 |
| 🚀 플릿 | git worktree 전체를 브랜치·미커밋·PR 상태와 함께 한눈에 |
| 🔀 내 PR | GitHub PR ↔ 코드 변경 ↔ 화면(Figma) 대조 |
| 🔔 모니터 | PR 리뷰·CI 실패·GitHub 이슈·(선택)Sentry를 통합 추적, 특이사항 토스트 |
| 🛠️ 개발중 | 지금 손댄 파일들의 API 정확성·테스트 유무 검증 |
| 📊 조사 / 📨 지시 | 대상 레포 git 이력 마이닝 / 업무 설명 → 에이전트 자동 배치 |
| 🗂️ 아키텍처 | src/ import 의존 그래프 |
| ✅ 테스트 | 어느 페이지에 뭐가 검증되는지 |
| 🔌 API | API ↔ 화면 매핑 |
| 🛠️ OpenRM 개선 | 이 레포 자체를 위한 내장 터미널 + 프롬프트 실시간 편집(자기개선) |

전체 설정 항목은 [`config.example.sh`](./config.example.sh) 참고 — 대부분 선택사항이고, 아무것도 안 채워도 위 기능 대부분이 동작합니다.

## 원본에서 빠진 것

사내 인프라(AWS MFA·원격 로그인·GTM·PPT·비공개 사내 도구)에 강하게 결합된 일부 기능은 이번 코어 릴리스에서 제외했습니다. 자세한 내용과 자기 이름으로 바꿔야 하는 부분(원작자 개인화 흔적)은 [`ADAPT.md`](./ADAPT.md)를 참고하세요.

## 보안

로컬 실행을 전제로 설계됐지만 git/셸/터미널을 직접 실행할 수 있는 서버라, 기본값은 `127.0.0.1` loopback 바인딩입니다. `MRM_HOST=0.0.0.0`으로 LAN에 열면 토큰 인증이 자동으로 요구됩니다(콘솔에 출력). 그래도 신뢰할 수 없는 네트워크에는 노출하지 마세요.

## License

[MIT](../LICENSE) — 리포 루트와 공유.
