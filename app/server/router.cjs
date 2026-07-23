// router.cjs — 업무 설명 → 적합 에이전트 자동 배치(점수화).
// 신호: 에이전트 전문영역(_note)·체인·이름과 업무 텍스트의 키워드 겹침 + 가용성(유휴·기동).
'use strict'
const fs = require('fs')
const C = require('./collector.cjs')

function readRaw() {
  try {
    return JSON.parse(fs.readFileSync(C.STATE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function tokens(s) {
  return (s || '')
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .filter((t) => t.length >= 2)
}

// 에이전트 프로필 = 이름 + _note/leadNote + chain + 현재 백로그 제목
function profiles() {
  const model = C.readModel()
  const raw = readRaw()
  const noteOf = {}
  for (const a of raw.currentAgents || []) noteOf[a.agent] = [a._note, a.note, a.claudeProcess?.leadNote].filter(Boolean).join(' ')
  const titleById = {}
  for (const b of raw.backlogs || []) titleById[b.id] = b.title || ''

  return (model.agents || []).map((a) => {
    const chainTitles = (a.chain || []).map((id) => titleById[id] || id).join(' ')
    const text = [a.agent, noteOf[a.agent] || '', (a.chain || []).join(' '), chainTitles].join(' ')
    return {
      agent: a.agent,
      session: a.tmuxSession,
      alive: a.tmuxAlive,
      status: a.status?.code,
      note: noteOf[a.agent] || '',
      chain: a.chain || [],
      profileTokens: new Set(tokens(text)),
    }
  })
}

function route(task) {
  if (!task || !task.trim()) return { error: '업무 설명이 필요합니다' }
  const tks = [...new Set(tokens(task))]
  const ranked = profiles()
    .map((p) => {
      const matched = tks.filter((t) => p.profileTokens.has(t) || [...p.profileTokens].some((pt) => pt.includes(t) || t.includes(pt)))
      let score = matched.length * 2
      const reasons = []
      if (matched.length) reasons.push(`업무 키워드 일치: ${matched.slice(0, 6).join(', ')}`)
      // 가용성 보너스
      if (p.alive) {
        score += 1
        reasons.push('tmux 기동중')
      } else reasons.push('미기동(전송 시 기동 필요)')
      if (p.status === 'idle' && p.alive) {
        score += 1.5
        reasons.push('유휴 — 바로 배정 가능')
      }
      if (p.status === 'working') {
        score -= 1
        reasons.push('작업중 — 큐잉됨')
      }
      return { agent: p.agent, session: p.session, alive: p.alive, status: p.status, note: p.note, score: Math.round(score * 10) / 10, matched, reasons }
    })
    .sort((a, b) => b.score - a.score)

  const top = ranked[0]
  return {
    task,
    recommended: top && top.score > 0 ? top.agent : null,
    confidence: top ? (top.score >= 6 ? 'high' : top.score >= 3 ? 'mid' : 'low') : 'low',
    ranked: ranked.slice(0, 6),
  }
}

module.exports = { route }
