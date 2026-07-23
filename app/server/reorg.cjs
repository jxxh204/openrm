// reorg.cjs — 폴더 재배치(reorg)의 영향 분석 + 리팩터 지시문 생성.
// "이 폴더를 옮기면 어디가 깨지나" = 역참조(reverse deps). 의존성 0.
'use strict'
const fs = require('fs')
const path = require('path')
const C = require('./collector.cjs')

const SRC = path.join(C.REPO, 'src')
const EXTS = ['.ts', '.tsx', '.js', '.jsx']
const IMPORT_RE = /(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g

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
    else if (EXTS.includes(path.extname(e.name))) out.push(p)
  }
  return out
}
function resolveSpec(spec, fromFile) {
  let base
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null
  const cands = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, 'index' + e))]
  for (const c of cands) {
    try {
      if (fs.statSync(c).isFile()) return c
    } catch {
      /* skip */
    }
  }
  return null
}
const relSrc = (p) => path.relative(SRC, p).replace(/\\/g, '/')

// 전체 src의 (파일 → import한 파일들) 역색인을 1회 빌드 후 캐시
let index = null
function buildIndex() {
  if (index && Date.now() - index.at < 120000) return index
  const reverse = new Map() // 대상파일 → Set(그걸 import하는 파일)
  for (const f of walk(SRC)) {
    let content = ''
    try {
      content = fs.readFileSync(f, 'utf8')
    } catch {
      continue
    }
    IMPORT_RE.lastIndex = 0
    let m
    while ((m = IMPORT_RE.exec(content))) {
      const spec = m[1] || m[2]
      if (!spec) continue
      const t = resolveSpec(spec, f)
      if (!t || !t.startsWith(SRC)) continue
      const tk = relSrc(t)
      if (!reverse.has(tk)) reverse.set(tk, new Set())
      reverse.get(tk).add(relSrc(f))
    }
  }
  index = { at: Date.now(), reverse }
  return index
}

// folderRel 아래(또는 그 파일) 를 import하는 외부 파일 목록
function impact(fromRel) {
  const { reverse } = buildIndex()
  const importers = new Set()
  const prefix = fromRel.replace(/\/$/, '')
  for (const [target, imps] of reverse) {
    if (target === prefix || target.startsWith(prefix + '/')) {
      for (const imp of imps) if (!imp.startsWith(prefix + '/') && imp !== prefix) importers.add(imp)
    }
  }
  return { from: fromRel, importerCount: importers.size, importers: [...importers].sort().slice(0, 60) }
}

const touchesCommon = (p) => /(^|\/)common(\/|$)/.test(p)

// reorg 플랜 → 리팩터 지시문 생성
function buildPrompt(plan) {
  const moves = (plan || []).filter((m) => m.from && m.to)
  if (!moves.length) return { error: '플랜이 비어있음' }
  const commonHit = moves.filter((m) => touchesCommon(m.from) || touchesCommon(m.to))
  let totalImpact = 0
  const lines = moves.map((m) => {
    const im = impact(m.from)
    totalImpact += im.importerCount
    return `- \`src/${m.from}\` → \`src/${m.to}\`  (영향: import하는 파일 ${im.importerCount}개)`
  })

  const prompt = [
    '다음 폴더 재배치를 수행하고, 깨지는 import 경로를 전부 갱신해줘.',
    '',
    '## 이동',
    ...lines,
    '',
    '## 요구사항',
    '1. `git mv`로 파일을 이동 (히스토리 보존).',
    "2. 이동된 경로를 import하던 모든 파일의 import 경로를 갱신 (`@/` 절대경로·상대경로 모두).",
    '3. barrel(index.ts) export 경로도 갱신.',
    '4. `yarn tsc --noEmit`로 끊긴 import 0 확인.',
    commonHit.length
      ? `5. ⚠️ common/ 경로가 포함됨(${commonHit.length}건) — [공용 컴포넌트 수정 금지] 룰 저촉 가능. 공용을 직접 옮기지 말고 도메인 wrapper로 우회하거나 사용자에게 확인.`
      : '5. 공용(common) 경로는 건드리지 않음 (확인됨).',
    '',
    `예상 영향 파일 합계: 약 ${totalImpact}개.`,
  ].join('\n')

  return { prompt, moves: moves.length, totalImpact, commonHit: commonHit.length }
}

module.exports = { impact, buildPrompt, touchesCommon }
