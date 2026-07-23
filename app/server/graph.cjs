// graph.cjs — 대상 레포 src/를 스캔해 import 의존 그래프를 만든다.
// 노드 = 파일 또는 폴더(collapse), 간선 = import. 노드는 종류(component/hook/atom/api/page/util)로 분류.
// 의존성 0 (정규식 스캐너). on-demand + 캐시.
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
    else if (EXTS.includes(path.extname(e.name)) && !/\.(test|spec|stories)\./.test(e.name)) out.push(p)
  }
  return out
}

// import 스펙을 실제 파일 경로로 해석 (상대 + '@/' 별칭)
function resolveSpec(spec, fromFile) {
  let base
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null // 외부 패키지
  const cands = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, 'index' + e))]
  for (const c of cands) {
    try {
      if (fs.statSync(c).isFile()) return c
    } catch {
      /* skip */
    }
  }
  return base + '.ts' // 미해석도 노드로(끊긴 import 표시용)
}

function relSrc(p) {
  return path.relative(SRC, p).replace(/\\/g, '/')
}

// 노드 종류 분류 (이름/경로 휴리스틱)
function classify(rel, content) {
  const base = rel.split('/').pop() || ''
  if (/recoil|atom\(|selector\(/.test(content) && /atom|selector|state|store/i.test(base)) return 'atom'
  if (/\/apis?\//.test(rel) || /(api|query|mutation|service)\.(ts|tsx)$/i.test(base) || /useQuery|useMutation/.test(content) && /api|query/i.test(base)) return 'api'
  if (/^use[A-Z]/.test(base)) return 'hook'
  if (/\/pages?\//.test(rel) || /Page\.(tsx|ts)$/.test(base)) return 'page'
  if (/^[A-Z]/.test(base) && /\.tsx$/.test(base)) return 'component'
  return 'util'
}

// 경로 → collapse 키 (folder 모드: src 아래 N세그먼트로 묶음)
function collapse(rel, depth) {
  const segs = rel.split('/')
  segs.pop() // 파일명 제거
  return segs.slice(0, depth).join('/') || '(root)'
}

let cache = {}

function build({ scope = '', mode = 'folder', depth = 3 } = {}) {
  const key = `${scope}|${mode}|${depth}`
  if (cache[key] && Date.now() - cache[key].at < 60000) return cache[key].data

  const root = scope ? path.join(SRC, scope) : SRC
  const files = walk(root)
  const nodes = new Map()
  const edges = new Map()

  const idOf = (absFile, content) => {
    const rel = relSrc(absFile)
    const id = mode === 'file' ? rel : collapse(rel, depth)
    if (!nodes.has(id)) nodes.set(id, { id, kind: mode === 'file' ? classify(rel, content || '') : 'folder', files: 0, deg: 0 })
    return id
  }

  for (const f of files) {
    let content = ''
    try {
      content = fs.readFileSync(f, 'utf8')
    } catch {
      continue
    }
    const fromId = idOf(f, content)
    nodes.get(fromId).files++

    IMPORT_RE.lastIndex = 0
    let m
    while ((m = IMPORT_RE.exec(content))) {
      const spec = m[1] || m[2]
      if (!spec) continue
      const target = resolveSpec(spec, f)
      if (!target) continue // 외부 패키지 스킵
      if (!target.startsWith(SRC)) continue
      const toId = idOf(target)
      if (toId === fromId) continue
      const ek = `${fromId}${toId}`
      edges.set(ek, (edges.get(ek) || 0) + 1)
    }
  }

  const edgeArr = [...edges.entries()].map(([k, w]) => {
    const [from, to] = k.split('')
    return { from, to, weight: w }
  })
  for (const e of edgeArr) {
    if (nodes.has(e.from)) nodes.get(e.from).deg++
    if (nodes.has(e.to)) nodes.get(e.to).deg++
  }

  const data = {
    scope: scope || '(src 전체)',
    mode,
    depth,
    counts: { nodes: nodes.size, edges: edgeArr.length, files: files.length },
    nodes: [...nodes.values()],
    edges: edgeArr,
    builtAt: new Date().toISOString(),
  }
  cache[key] = { at: Date.now(), data }
  return data
}

// 폴더 목록 (scope 셀렉터용)
function scopes() {
  const out = []
  const scan = (dir, rel, lvl) => {
    if (lvl > 2) return
    let ents
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        const r = rel ? `${rel}/${e.name}` : e.name
        out.push(r)
        scan(path.join(dir, e.name), r, lvl + 1)
      }
    }
  }
  scan(SRC, '', 0)
  return out.slice(0, 200)
}

module.exports = { build, scopes }
