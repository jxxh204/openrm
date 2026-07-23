// apiusage.cjs — 폴더의 API 사용 현황 + 오용 플래그 추출.
// API 레이어 = '@/libs/apiV2' (이 프로젝트 컨벤션). react-query 훅 사용도 함께.
// "잘못 쓰고 있으면 바로 보이게" — 오용 휴리스틱 플래그.
'use strict'
const fs = require('fs')
const path = require('path')
const C = require('./collector.cjs')

const SRC = path.join(C.REPO, 'src')
const EXTS = ['.ts', '.tsx']
const API_MODULE = '@/libs/apiV2'

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
const relSrc = (p) => path.relative(SRC, p).replace(/\\/g, '/')

function namedImports(content, mod) {
  // import apiV2, { a, b as c } from 'mod'  /  import { x } from 'mod'
  // 음성 룩어헤드로 clause가 다른 import의 'from'을 넘지 않게 (앞 import 삼킴 방지)
  const re = new RegExp(`import\\s+((?:(?!\\bfrom\\b)[\\s\\S])*?)\\s+from\\s+['"]${mod.replace(/[/]/g, '\\/')}['"]`, 'g')
  const names = new Set()
  let m
  while ((m = re.exec(content))) {
    const clause = m[1]
    const brace = clause.match(/\{([\s\S]*?)\}/)
    if (brace) for (const part of brace[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '').trim()
      if (name) names.add(name)
    }
    const def = clause.replace(/\{[\s\S]*?\}/, '').replace(/,/g, '').trim()
    if (def && def !== 'type') names.add(def)
  }
  return [...names]
}

// 단일 파일 스캔 → { usesApi, apiCalls{}, hooks{}, flags[] }. 폴더 분석·개발중 검증 공용.
function scanFile(rel, c) {
  const usesApi = c.includes(API_MODULE)
  const apiCalls = {}
  const hooks = { useQuery: 0, useMutation: 0, useSuspenseQuery: 0, useInfiniteQuery: 0 }
  const flags = []

  if (usesApi) {
    let mm
    const callRe = /\bapiV2\.(\w+)\s*\(/g
    while ((mm = callRe.exec(c))) apiCalls[`apiV2.${mm[1]}`] = (apiCalls[`apiV2.${mm[1]}`] || 0) + 1
    for (const n of namedImports(c, API_MODULE)) {
      if (/^[a-z]/.test(n) && n !== 'apiV2') apiCalls[n] = (apiCalls[n] || 0) + 1
    }
  }
  for (const h of Object.keys(hooks)) hooks[h] = (c.match(new RegExp(`\\b${h}\\b`, 'g')) || []).length

  const isComponent = /[A-Z]\w*\.tsx$/.test(rel)
  const inQueryLayer = /\/(queries|hooks|apis?|services?)\//.test(rel)
  const add = (level, msg) => flags.push({ level, file: rel, msg })

  if (/\baxios\b/.test(c) || /(?<!re)\bfetch\s*\(/.test(c)) add('high', 'raw axios/fetch 사용 — apiV2 레이어 우회')
  if (/\buseQuery\s*\(/.test(c) && !/queryKey/.test(c)) add('mid', 'useQuery에 queryKey 없음(추정) — 캐시 키 확인 필요')
  if (usesApi && isComponent && !inQueryLayer) add('mid', '컴포넌트에서 apiV2 직접 호출 — queries 레이어 우회 가능')
  if (/\.then\s*\(/.test(c) && usesApi && isComponent) add('low', '컴포넌트에서 API .then() 직접 처리 — react-query 미사용 의심')
  if (usesApi) {
    const castCall = (c.match(/apiV2\.\w+\s*\([\s\S]*?\)\s*(?:\)\s*)?as\s+\w/g) || []).length
    if (castCall) add('high', `apiV2 호출 결과를 as 캐스팅 ${castCall}곳 — 생성된 계약 타입 우회`)
    const asAny = (c.match(/\bas\s+(any|unknown)\b/g) || []).length
    if (asAny) add('high', `as any/unknown ${asAny}곳 — API 타입 무력화`)
    const colonAny = (c.match(/:\s*any\b/g) || []).length
    if (colonAny) add('mid', `: any 타입 ${colonAny}곳 — apiV2 타입 대신 any 사용`)
    if (/@ts-(ignore|expect-error)/.test(c)) add('mid', '@ts-ignore/@ts-expect-error — 타입 검사 우회')
  }
  return { usesApi, apiCalls, hooks, flags }
}

// folderRel 아래 전체 스캔 → API 사용 집계 + 플래그
function analyze(folderRel) {
  const root = folderRel ? path.join(SRC, folderRel) : SRC
  const files = walk(root)
  const apiFns = {}
  const hooks = { useQuery: 0, useMutation: 0, useSuspenseQuery: 0, useInfiniteQuery: 0 }
  const flags = []
  let apiFiles = 0

  for (const f of files) {
    let c = ''
    try {
      c = fs.readFileSync(f, 'utf8')
    } catch {
      continue
    }
    const r = scanFile(relSrc(f), c)
    if (r.usesApi) apiFiles++
    for (const [k, v] of Object.entries(r.apiCalls)) apiFns[k] = (apiFns[k] || 0) + v
    for (const h of Object.keys(hooks)) hooks[h] += r.hooks[h]
    flags.push(...r.flags)
  }

  const apiList = Object.entries(apiFns)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return {
    folder: folderRel || '(src 전체)',
    counts: { files: files.length, apiFiles, apiFns: apiList.length, flags: flags.length },
    apiList,
    hooks,
    flags: flags.slice(0, 80),
    builtAt: new Date().toISOString(),
  }
}

module.exports = { analyze, scanFile, SRC }
