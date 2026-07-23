// tests.cjs — "어느 페이지에 뭐가 검증되는지" 분석.
// 테스트 파일의 describe/it 제목 = 검증 항목 그 자체. 영역(페이지)별로 묶고, 미검증(갭)도 짚는다.
'use strict'
const fs = require('fs')
const path = require('path')
const C = require('./collector.cjs')

const SRC = path.join(C.REPO, 'src')
const TESTRE = /\.(test|spec)\.(ts|tsx|js|jsx)$/
const CODE = ['.ts', '.tsx']

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
    else out.push(p)
  }
  return out
}
const relSrc = (p) => path.relative(SRC, p).replace(/\\/g, '/')

// 경로 → 영역(페이지/도메인) 키
function area(rel) {
  const s = rel.split('/')
  if (s[0] === 'domains') return `domains/${s[1] || '?'}${s[2] === 'web' || s[2] === 'webview' ? '/' + s[2] : ''}`
  if (s[0] === 'pages') return 'pages'
  return s[0] || '?'
}

function parseTitles(content) {
  const itRe = /\b(?:it|test)(?:\.\w+)?\s*\(\s*[`'"]([^`'"]+)[`'"]/g
  const dRe = /\bdescribe(?:\.\w+)?\s*\(\s*[`'"]([^`'"]+)[`'"]/g
  const its = []
  const describes = []
  let m
  while ((m = itRe.exec(content))) its.push(m[1])
  while ((m = dRe.exec(content))) describes.push(m[1])
  return { describes, its }
}

function testType(content) {
  if (/@playwright|playwright/.test(content)) return 'e2e'
  if (/renderHook/.test(content)) return 'hook'
  if (/@testing-library\/react/.test(content)) return 'component'
  return 'unit'
}

let cache = null
function inventory() {
  if (cache && Date.now() - cache.at < 60000) return cache.data

  const all = walk(SRC)
  const testFiles = all.filter((f) => TESTRE.test(f))

  // 테스트 있는 컴포넌트/페이지 basename 집합 (갭 계산용)
  const testedBase = new Set()
  const areas = {}
  let totalCases = 0

  const items = testFiles.map((f) => {
    let c = ''
    try {
      c = fs.readFileSync(f, 'utf8')
    } catch {
      /* skip */
    }
    const rel = relSrc(f)
    const { describes, its } = parseTitles(c)
    totalCases += its.length
    const base = path.basename(f).replace(TESTRE, '')
    testedBase.add(path.dirname(rel) + '/' + base)
    const a = area(rel)
    areas[a] = (areas[a] || 0) + 1
    return { file: rel, area: a, type: testType(c), suite: describes[0] || base, cases: its, caseCount: its.length }
  })

  // 갭: 컴포넌트/페이지(PascalCase.tsx 또는 *Page.tsx)인데 형제 테스트 없음
  const gaps = []
  for (const f of all) {
    const rel = relSrc(f)
    const baseName = path.basename(f)
    // 진짜 화면 코드만 (.tsx). mock·시나리오·스토리·테스트·타입선언 제외
    if (path.extname(f) !== '.tsx') continue
    if (TESTRE.test(f) || /\.(stories|scenario|mock|d)\./.test(baseName)) continue
    if (/(^|\/)(__mocks__|__test__|mocks|stories)(\/|$)/.test(rel)) continue
    const isPage = /Page\.tsx$/.test(baseName) || /(^|\/)pages\//.test(rel)
    const isComponent = /^[A-Z]\w*\.tsx$/.test(baseName)
    if (!isPage && !isComponent) continue
    const key = path.dirname(rel) + '/' + baseName.replace(/\.tsx$/, '')
    if (!testedBase.has(key)) gaps.push({ file: rel, kind: isPage ? 'page' : 'component', area: area(rel) })
  }

  // 영역별 그룹 정렬
  const byArea = Object.entries(areas)
    .map(([a, n]) => ({ area: a, files: n }))
    .sort((x, y) => y.files - x.files)

  // 커버리지 요약(있으면)
  let coverage = null
  const covPath = path.join(C.REPO, 'coverage', 'coverage-summary.json')
  try {
    if (fs.existsSync(covPath)) {
      const cov = JSON.parse(fs.readFileSync(covPath, 'utf8'))
      coverage = cov.total
    }
  } catch {
    /* skip */
  }

  const data = {
    counts: {
      files: testFiles.length,
      cases: totalCases,
      areas: byArea.length,
      gaps: gaps.length,
      byType: items.reduce((o, i) => ((o[i.type] = (o[i.type] || 0) + 1), o), {}),
    },
    byArea,
    items: items.sort((a, b) => a.file.localeCompare(b.file)),
    gaps: gaps.sort((a, b) => a.file.localeCompare(b.file)),
    coverage,
    builtAt: new Date().toISOString(),
  }
  cache = { at: Date.now(), data }
  return data
}

module.exports = { inventory }
