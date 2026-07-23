// tree.cjs — VSCode식 파일 트리 + 폴더 상세(파일/테스트/스토리/API).
// 의존성 0. on-demand + 캐시.
'use strict'
const fs = require('fs')
const path = require('path')
const C = require('./collector.cjs')
const Api = require('./apiusage.cjs')

const SRC = path.join(C.REPO, 'src')
const CODE = ['.ts', '.tsx', '.js', '.jsx']

function isTest(n) {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(n)
}
function isStory(n) {
  return /\.stories\.(ts|tsx)$/.test(n)
}

// 폴더 트리 (각 노드에 재귀 카운트)
function buildTree(dir, rel) {
  let ents
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return null
  }
  const children = []
  let files = 0,
    tests = 0,
    stories = 0
  for (const e of ents.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const cRel = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) {
      const sub = buildTree(path.join(dir, e.name), cRel)
      if (sub) {
        children.push(sub)
        files += sub.files
        tests += sub.tests
        stories += sub.stories
      }
    } else {
      if (isTest(e.name)) tests++
      else if (isStory(e.name)) stories++
      else if (CODE.includes(path.extname(e.name))) files++
    }
  }
  return { name: rel ? rel.split('/').pop() : 'src', path: rel, type: 'dir', files, tests, stories, children }
}

let treeCache = null
function tree() {
  if (treeCache && Date.now() - treeCache.at < 30000) return treeCache.data
  const data = buildTree(SRC, '')
  treeCache = { at: Date.now(), data }
  return data
}

// 스토리 title 파싱 → storybook slug
function storySlug(content) {
  const m = content.match(/title\s*:\s*['"]([^'"]+)['"]/)
  if (!m) return null
  return m[1]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// 폴더 상세
function folder(rel) {
  const dir = rel ? path.join(SRC, rel) : SRC
  let ents
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return { error: `폴더 없음: src/${rel}` }
  }
  const files = []
  const tests = []
  const stories = []
  for (const e of ents) {
    if (e.isDirectory() || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (isTest(e.name)) {
      tests.push(e.name)
    } else if (isStory(e.name)) {
      let slug = null
      try {
        slug = storySlug(fs.readFileSync(p, 'utf8'))
      } catch {
        /* skip */
      }
      stories.push({ file: e.name, slug })
    } else if (CODE.includes(path.extname(e.name))) {
      files.push(e.name)
    }
  }
  return {
    folder: rel || '(src)',
    files: files.sort(),
    tests: tests.sort(),
    stories: stories.sort((a, b) => a.file.localeCompare(b.file)),
    api: Api.analyze(rel),
    builtAt: new Date().toISOString(),
  }
}

module.exports = { tree, folder }
