// msw.cjs — 웹 레포의 MSW 페이지 시나리오(src/__mocks__/scenarios/pages/*.scenario.ts)를 정적 파싱.
// ts-node/빌드 없이 정규식으로 pageId·routes·apis·useCases(meta) 추출 → 디버깅에서 '현재 페이지 시나리오' 표시.
'use strict'
const fs = require('fs')
const path = require('path')
const C = require('./collector.cjs')

const REL_DIR = 'src/__mocks__/scenarios/pages'

// 한 .scenario.ts 파일 → { pageId, pageName, description, routes, apis, useCases:[{id,name,description,tags}] }
function parseScenarioFile(src) {
	const pick = (re) => (src.match(re) || [])[1]
	const pageId = pick(/pageId:\s*['"]([^'"]+)['"]/)
	if (!pageId) return null
	const pageName = pick(/pageName:\s*['"]([^'"]+)['"]/) || pageId
	// 페이지 설명 = pageName 직후의 첫 description (useCases 이전)
	const head = src.split(/useCases\s*:/)[0]
	const description = ((head.match(/description:\s*['"]([^'"]*)['"]/) || [])[1]) || ''
	const arr = (m) => (m ? m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean) : [])
	const routes = arr(src.match(/routes:\s*\[([^\]]*)\]/))
	const apis = arr(head.match(/\bapis:\s*\[([^\]]*)\]/)) // 페이지 레벨 apis(배열). useCase의 apis는 객체라 제외.
	const useCases = []
	const seen = new Set()
	const metaRe = /meta:\s*\{([\s\S]*?)\}/g
	let m
	while ((m = metaRe.exec(src))) {
		const body = m[1]
		const id = (body.match(/id:\s*['"]([^'"]+)['"]/) || [])[1]
		if (!id || seen.has(id)) continue
		seen.add(id)
		useCases.push({
			id,
			name: (body.match(/name:\s*['"]([^'"]+)['"]/) || [])[1] || id,
			description: (body.match(/description:\s*['"]([^'"]*)['"]/) || [])[1] || '',
			tags: arr(body.match(/tags:\s*\[([^\]]*)\]/)),
		})
	}
	return { pageId, pageName, description, routes, apis, useCases }
}

// cwd(있으면 그 워크트리, 없으면 메인 웹레포)의 페이지 시나리오 전부
function listScenarios(cwd) {
	const root = cwd && fs.existsSync(path.join(cwd, REL_DIR)) ? cwd : C.REPO
	const dir = path.join(root, REL_DIR)
	let files = []
	try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.scenario.ts')) } catch (_) { return { ok: false, error: `시나리오 폴더 없음: ${dir}`, root, pages: [] } }
	const pages = []
	for (const f of files) {
		try {
			const parsed = parseScenarioFile(fs.readFileSync(path.join(dir, f), 'utf8'))
			if (parsed) pages.push({ ...parsed, file: REL_DIR + '/' + f })
		} catch (_) {}
	}
	return { ok: true, root, pages }
}

// 현재 경로(pathname)에 매칭되는 페이지만. route가 pathname의 접미/접두거나 포함되면 매칭.
function forPath(pathname, cwd) {
	const all = listScenarios(cwd)
	if (!all.ok) return all
	const p = String(pathname || '').split('?')[0].replace(/\/$/, '') || '/'
	const match = (route) => {
		const r = String(route).replace(/\/$/, '')
		if (!r) return false
		// 동적 세그먼트([id]/:id) 유연 매칭
		const rx = new RegExp('^' + r.replace(/\[[^\]]+\]|:[^/]+/g, '[^/]+').replace(/[.*+?^${}()|\\]/g, (c) => (c === '*' ? '.*' : '\\' + c)) + '(/|$)')
		return rx.test(p) || p.indexOf(r) >= 0
	}
	const pages = all.pages.filter((pg) => (pg.routes || []).some(match))
	return { ok: true, root: all.root, pathname: p, pages, totalPages: all.pages.length }
}

module.exports = { listScenarios, forPath, parseScenarioFile }
