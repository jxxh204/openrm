// analyze.cjs — 대상 레포의 git 이력 + state.json을 채굴해 "작업 방식" 리포트 생성.
// 무겁다(git log 파싱) → on-demand 호출 + 짧은 캐시. 의존성 0.
'use strict'
const { execFile } = require('child_process')
const C = require('./collector.cjs')

const REPO = C.REPO

function git(args, timeoutMs = 15000) {
  return new Promise((resolve) => {
    execFile('git', ['-C', REPO, ...args], { timeout: timeoutMs, maxBuffer: 32 << 20 }, (err, out) =>
      resolve(err ? '' : String(out || '')),
    )
  })
}

// path → 도메인 버킷 ("src/domains/message/..." → "domains/message")
function bucket(p) {
  const s = p.split('/')
  if (s[0] === 'src' && s[1] === 'domains') return `domains/${s[2] || '?'}`
  if (s[0] === 'src') return `src/${s[1] || '?'}`
  return s[0] || '?'
}

let cache = { at: 0, days: 0, data: null }

async function analyze(days = 90) {
  if (cache.data && cache.days === days && Date.now() - cache.at < 60000) return cache.data

  // ── 커밋 이력: hash \t authorISO \t author ──
  const log = await git(['log', `--since=${days}.days`, '--no-merges', '--pretty=format:%H\t%aI\t%an'])
  const commits = log
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [hash, iso, author] = l.split('\t')
      return { hash, iso, author }
    })

  const byHour = Array(24).fill(0)
  const byWeekday = Array(7).fill(0) // 0=일
  const byDay = {}
  const authors = {}
  let night = 0
  for (const c of commits) {
    if (!c.iso) continue
    const hour = parseInt(c.iso.slice(11, 13), 10)
    if (!Number.isNaN(hour)) {
      byHour[hour]++
      if (hour >= 22 || hour < 6) night++
    }
    const d = new Date(c.iso)
    if (!Number.isNaN(d.getTime())) byWeekday[d.getDay()]++
    const day = c.iso.slice(0, 10)
    byDay[day] = (byDay[day] || 0) + 1
    authors[c.author] = (authors[c.author] || 0) + 1
  }

  const dayList = Object.entries(byDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  const topAuthors = Object.entries(authors)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // ── 도메인 churn: 최근 30일 numstat ──
  const churnDays = Math.min(days, 30)
  const ns = await git(['log', `--since=${churnDays}.days`, '--no-merges', '--numstat', '--pretty=format:'])
  const churn = {}
  for (const line of ns.split('\n')) {
    const m = line.split('\t')
    if (m.length !== 3) continue
    const add = parseInt(m[0], 10)
    const del = parseInt(m[1], 10)
    if (Number.isNaN(add) && Number.isNaN(del)) continue // 바이너리(-)
    const b = bucket(m[2])
    const e = (churn[b] = churn[b] || { path: b, files: 0, add: 0, del: 0 })
    e.files++
    e.add += add || 0
    e.del += del || 0
  }
  const domainChurn = Object.values(churn)
    .filter((c) => /^(src|domains)\//.test(c.path)) // 코드 버킷만 (wiki/docs 등 노이즈 제외)
    .sort((a, b) => b.add + b.del - (a.add + a.del))
    .slice(0, 12)

  // ── state.json 파생: 백로그 레인 + 에이전트 가동률 ──
  const model = C.readModel()
  const agentUtil = (model.agents || [])
    .map((a) => ({ agent: a.agent, chainLen: (a.chain || []).length, status: a.status?.code, alive: a.tmuxAlive }))
    .sort((a, b) => b.chainLen - a.chainLen)

  const data = {
    range: { days, since: commits.length ? commits[commits.length - 1].iso?.slice(0, 10) : null, totalCommits: commits.length },
    activeDays: Object.keys(byDay).length,
    nightRatio: commits.length ? night / commits.length : 0,
    byHour,
    byWeekday,
    byDay: dayList,
    topAuthors,
    domainChurn,
    backlogLanes: model.counts?.byLane || {},
    backlogTotal: model.counts?.backlogs || 0,
    agentUtil,
    feature: model.feature,
    builtAt: new Date().toISOString(),
  }
  cache = { at: Date.now(), days, data }
  return data
}

module.exports = { analyze }
