# 재작성 권장 목록

회사·제품·도메인·개인 식별자는 모두 제거됐지만(자동 스캔 0), 아래 파일들은 **디자인시스템 토큰 카탈로그**나 **특정 도메인 예시**가 본문이라 자기 프로젝트에 맞게 손보면 더 유용합니다. (동작은 함)

## 🎨 디자인시스템 토큰 카탈로그가 본문
자기 DS의 색/타이포/컴포넌트 토큰으로 교체 권장.
- `agents/android-figma-ui-analyzer.md`
- `agents/ios-figma-ui-analyzer.md`
- `agents/android-figma-policy-analyzer.md`
- `agents/ios-implementation-verifier.md`

## 🧩 특정 도메인 예시가 본문
샘플 도메인(예약/샵 등)을 자기 도메인으로 교체 권장.
- `skills/business-domain/` — 도메인 배경지식 스킬(제네릭 예시로 새로 쓰는 게 이상적)
- `skills/impact-analysis/`
- `agents/android-ui-test-generator.md`, `agents/android-ui-test-planner.md`

## ⚙️ 운영 에이전트 (인프라 값 필요)
식별자는 `config`로 뺐지만 각자 인프라(DB·SSH·로그경로)를 채워야 실동작. 안 쓰면 무시.
- `agents/backend-cs-handler.md` — `${DB_PROFILE}`
- `agents/backend-infra-mapper.md` — `${SSH_HOST}`·`${EB_ENV}`·`${APP}`

## 참고: b2b/b2c 병합
원본의 `b2b-*`/`b2c-*` 중복 쌍(android/ios 계열 12쌍)은 하나로 병합했고, 내용이 달랐던 경우 b2b(CRM) 버전을 채택했습니다.
