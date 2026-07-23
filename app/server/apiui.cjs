// apiui.cjs — "API ↔ 화면" 매핑. GTM 페이지가 data-track-id를 <요소>"라벨"에 엮듯,
// 여기선 각 API 호출/훅을 그걸 쓰는 컴포넌트(<이름> "보이는 라벨")에 엮어 UI 언어로 보여준다.
// 엔진은 apiusage.scanFile 재사용. 의존성 0.
'use strict'
const fs = require('fs')
const path = require('path')
const C = require('./collector.cjs')
const Api = require('./apiusage.cjs')

const SRC = path.join(C.REPO, 'src')
const relSrc = (p) => path.relative(SRC, p).replace(/\\/g, '/')

function walk(dir, out = []) {
	let ents
	try {
		ents = fs.readdirSync(dir, { withFileTypes: true })
	} catch {
		return out
	}
	for (const e of ents) {
		if (e.name === 'node_modules' || e.name.startsWith('.')) continue
		const p = path.join(dir, e.name)
		if (e.isDirectory()) walk(p, out)
		else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec|stories)\./.test(e.name)) out.push(p)
	}
	return out
}

// 경로 → 도메인/영역 (테스트·GTM 페이지와 동일 규칙)
function area(rel) {
	const s = rel.split('/')
	if (s[0] === 'domains') return `domains/${s[1] || '?'}${s[2] === 'web' || s[2] === 'webview' ? '/' + s[2] : ''}`
	if (s[0] === 'pages') return 'pages'
	return s[0] || '?'
}

// 컴포넌트/모듈 표시 이름
function displayName(rel, c) {
	const m =
		c.match(/export default function (\w+)/) ||
		c.match(/export default (\w+)/) ||
		c.match(/export const ([A-Z]\w*)\s*[:=]/) ||
		c.match(/function ([A-Z]\w*)\s*\(/) ||
		c.match(/const ([A-Z]\w*)\s*=\s*\(/)
	if (m) return m[1]
	const base = path.basename(rel).replace(/\.(tsx|ts)$/, '')
	return base === 'index' ? path.basename(path.dirname(rel)) : base
}

// 화면의 "보이는 라벨" — title/heading prop 또는 첫 한글 텍스트 노드
function uiLabel(c) {
	let m = c.match(/(?:title|label|heading|placeholder|aria-label)\s*=\s*["'`]\s*([가-힣][^"'`{}]{0,28})/)
	if (m) return m[1].trim()
	m = c.match(/>\s*([가-힣][^<>{}]{0,28}[가-힣?!.])\s*</)
	if (m) return m[1].trim()
	m = c.match(/>\s*([가-힣][^<>{}]{0,28})/)
	return m ? m[1].trim() : null
}

let cache = null
function inventory() {
	if (cache && Date.now() - cache.at < 60000) return cache.data
	let files
	try {
		files = walk(SRC)
	} catch (e) {
		return { error: 'src walk 실패: ' + e.message }
	}

	const screens = []
	const endpointIdx = {} // endpoint name → [{ file, component, label }]
	for (const f of files) {
		let c = ''
		try {
			c = fs.readFileSync(f, 'utf8')
		} catch {
			continue
		}
		const rel = relSrc(f)
		const scan = Api.scanFile(rel, c)
		const hookSum = Object.values(scan.hooks).reduce((a, b) => a + b, 0)
		if (!scan.usesApi && hookSum === 0) continue // API를 안 건드리는 파일은 제외

		const component = displayName(rel, c)
		const label = /\.tsx$/.test(rel) ? uiLabel(c) : null
		const apiCalls = Object.entries(scan.apiCalls).map(([name, count]) => ({ name, count }))
		const hooks = Object.fromEntries(Object.entries(scan.hooks).filter(([, v]) => v > 0))
		const raw = scan.flags.some((fl) => fl.level === 'high')
		const kind = /\.tsx$/.test(rel) ? 'component' : /\/(queries|hooks|apis?|services?)\//.test(rel) ? 'query-layer' : 'logic'

		screens.push({ file: 'src/' + rel, area: area(rel), component, label, kind, apiCalls, hooks, flags: scan.flags, raw })
		for (const { name } of apiCalls) (endpointIdx[name] = endpointIdx[name] || []).push({ file: 'src/' + rel, component, label })
	}

	screens.sort((a, b) => (b.raw ? 1 : 0) - (a.raw ? 1 : 0) || a.file.localeCompare(b.file))
	const endpoints = Object.entries(endpointIdx)
		.map(([name, uses]) => ({ name, count: uses.length, screens: uses }))
		.sort((a, b) => b.count - a.count)

	const data = {
		repo: C.REPO,
		screens,
		endpoints,
		counts: {
			screens: screens.length,
			components: screens.filter((s) => s.kind === 'component').length,
			endpoints: endpoints.length,
			raw: screens.filter((s) => s.raw).length,
			domains: new Set(screens.map((s) => s.area)).size,
		},
		builtAt: new Date().toISOString(),
	}
	cache = { at: Date.now(), data }
	return data
}

module.exports = { inventory }
