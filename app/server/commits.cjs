// commits.cjs — 커밋 단위 검증. 커밋 메시지=내가 시킨 것(의도), diff=한 것, 분석기=잘했나.
// 각 커밋의 변경 파일을 그 커밋 시점 blob으로 평가. 테스트 동반 여부도 본다.
'use strict'
const C = require('./collector.cjs')
const A = require('./active.cjs')

const TESTRE = /\.(test|spec)\.(ts|tsx|js|jsx)$/

async function commits(n = 12) {
  const log = await A.git(['log', '-n', String(n), '--no-merges', '--pretty=format:%H%x09%an%x09%ad%x09%s', '--date=short'])
  const lines = log.split('\n').filter(Boolean)
  const out = []

  for (const line of lines) {
    const [hash, author, date, subject] = line.split('\t')
    const ns = await A.git(['show', '--name-status', '--format=', hash, '--', 'src'])
    const changed = ns
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const parts = l.split('\t')
        return { status: parts[0], path: parts[parts.length - 1] }
      })

    const touchedTest = changed.some((c) => TESTRE.test(c.path))
    const verifiable = changed.filter((c) => A.isVerifiable(c.path) && c.status[0] !== 'D').slice(0, 25)

    const items = []
    for (const c of verifiable) {
      const content = await A.git(['show', `${hash}:${c.path}`])
      if (!content) continue
      items.push(A.evaluateFile(c.path, content, c.status))
    }
    const rank = { bad: 0, warn: 1, ok: 2 }
    items.sort((a, b) => rank[a.verdict] - rank[b.verdict])

    const bad = items.filter((i) => i.verdict === 'bad').length
    const missingTest = items.filter((i) => i.test === 'none').length
    const touchesUI = items.some((i) => /\.tsx$/.test(i.file))
    const touchesApi = items.some((i) => i.usesApi)

    // 커밋 판정
    let verdict = 'ok'
    const issues = []
    if (bad) {
      verdict = 'bad'
      issues.push(`API 오용 ${bad}`)
    }
    if (touchesUI && !touchedTest && missingTest) {
      if (verdict === 'ok') verdict = 'warn'
      issues.push('UI 변경에 테스트 미동반')
    } else if (items.some((i) => i.verdict === 'warn') && verdict === 'ok') {
      verdict = 'warn'
      issues.push('의심 항목 있음')
    }

    out.push({
      hash: hash.slice(0, 9),
      author,
      date,
      subject,
      changedCount: changed.length,
      touchedTest,
      touchesUI,
      touchesApi,
      verdict,
      issues,
      items,
    })
  }

  return {
    counts: {
      commits: out.length,
      bad: out.filter((c) => c.verdict === 'bad').length,
      warn: out.filter((c) => c.verdict === 'warn').length,
      ok: out.filter((c) => c.verdict === 'ok').length,
      noTest: out.filter((c) => c.touchesUI && !c.touchedTest).length,
    },
    commits: out,
    builtAt: new Date().toISOString(),
  }
}

module.exports = { commits }
