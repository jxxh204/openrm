// gtm.cjs (stub) — 원본의 GTM(Google Tag Manager) 추적 인벤토리 기능은 특정 마케팅 태깅 컨벤션에 결합되어 OpenRM 코어에서 제외.
'use strict'
function inventory() {
	return { items: [], disabled: true, message: 'GTM 인벤토리는 OpenRM 코어에서 제외된 기능입니다.' }
}

module.exports = { inventory }
