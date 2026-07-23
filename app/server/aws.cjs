// aws.cjs (stub) — 원본의 AWS MFA 세션 갱신 기능은 사내 인프라 결합이 강해 OpenRM 코어에서 제외.
// UI(WatchPage)가 "설정 필요"로 자연스럽게 표시되도록 안전한 비활성 응답만 반환.
'use strict'
async function status() {
	return { ok: true, configured: false, disabled: true, message: 'AWS MFA는 OpenRM 코어에서 제외된 기능입니다.' }
}
async function renew() {
	return { ok: false, error: 'disabled in OpenRM core' }
}
function startExpiryWatch() {}

module.exports = { status, renew, startExpiryWatch }
