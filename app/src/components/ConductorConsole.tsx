import { useEffect, useMemo, useRef, useState } from 'react'
import XTerm from './XTerm'

// 그룹 지휘 콘솔 — 오케스트레이터 XTerm + 함대(서브에이전트 모델·상태) + 활동 피드(유기적 대화).
interface Term {
	name: string
	label: string
	cwd: string
	model?: string | null
	status?: { working?: boolean; waiting?: boolean; needsAuth?: boolean; exists?: boolean; tail?: string } | null
}
interface Member {
	key: string
	ticket: string | null
	title: string
	streams: { path: string }[]
}
interface FeedRow {
	ts: number
	from: string
	to: string
	text: string
	kind: string
}
interface OrchStatus {
	active?: boolean
	session?: string
	model?: string | null
	status?: Term['status']
}
const modelTag = (m?: string | null): string => (!m ? '' : /opus/.test(m) ? 'opus' : /sonnet/.test(m) ? 'sonnet' : /haiku/.test(m) ? 'haiku' : /fable/.test(m) ? 'fable' : m.replace(/^claude-/, ''))
const agentState = (s?: Term['status']) => (s?.needsAuth ? { c: 'auth', t: '⚠️' } : s?.working ? { c: 'work', t: '⚙️' } : s?.waiting ? { c: 'wait', t: '💬' } : s?.exists === false ? { c: 'dead', t: '⚪' } : { c: 'idle', t: '✅' })

export default function ConductorConsole({ group, members, terms, onToggleTerm, openTerms }: { group: string; members: Member[]; terms: Term[]; onToggleTerm: (name: string) => void; openTerms: Set<string> }) {
	const [status, setStatus] = useState<OrchStatus>({})
	const [feed, setFeed] = useState<FeedRow[]>([])
	const [busy, setBusy] = useState(false)
	const [max, setMax] = useState(false) // 전체화면 확대 (tmux 자식 가림 해소)
	const g = encodeURIComponent(group)
	const feedEnd = useRef<HTMLDivElement>(null)

	const load = () => {
		fetch(`/api/orch/status?group=${g}`).then((r) => r.json()).then((d) => d.ok && setStatus(d)).catch(() => {})
		fetch(`/api/orch/feed?group=${g}`).then((r) => r.json()).then((d) => d.ok && setFeed(d.feed || [])).catch(() => {})
	}
	useEffect(() => {
		load()
		const id = setInterval(load, 3000)
		return () => clearInterval(id)
	}, [group])
	useEffect(() => {
		feedEnd.current?.scrollIntoView({ block: 'nearest' })
	}, [feed.length])

	// 멤버 → 서브에이전트 세션 (cwd 일치 or 티켓 포함, orch 제외)
	const agentFor = (m: Member): Term | null => terms.find((t) => !/^mrm-orch-/.test(t.name) && (m.streams.some((s) => s.path === t.cwd) || (m.ticket ? t.label.includes(m.ticket) : false))) || null
	// 최근(8초) 피드에서 활성 티켓 → 노드 점멸
	const activeTickets = useMemo(() => {
		const now = Date.now()
		const s = new Set<string>()
		for (const e of feed) if (now - e.ts < 8000) [e.from, e.to].forEach((x) => x && x !== 'orch' && x !== '마티' && s.add(x))
		return s
	}, [feed])

	const start = () => {
		setBusy(true)
		fetch('/api/orch/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group }) })
			.then((r) => r.json())
			.then(() => load())
			.finally(() => setBusy(false))
	}
	const stop = () => {
		if (!confirm(`'${group}' 지휘자를 종료합니다.`)) return
		fetch('/api/orch/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group }) }).then(() => load())
	}
	const orchState = agentState(status.status)

	return (
		<div className={`conductor ${max ? 'maximized' : ''}`}>
			<div className="cond-head">
				<span className="cond-title">🎼 {group} 지휘자</span>
				{status.active ? (
					<>
						<span className={`agent-chip ${orchState.c}`}>{orchState.t} 지휘 중</span>
						{status.model && <span className={`model-badge m-${modelTag(status.model)}`} title={status.model}>{modelTag(status.model)}</span>}
						<span className="cond-spacer" />
						<button className="btn-dry" onClick={() => { setMax((v) => !v); setTimeout(() => window.dispatchEvent(new Event('resize')), 130) }} title={max ? '축소' : '전체화면으로 크게 보기 (tmux 자식 가림 해소)'}>{max ? '🗕 축소' : '⛶ 확대'}</button>
						<button className="btn-dry" onClick={stop}>✕ 종료</button>
					</>
				) : (
					<>
						<span className="muted">지휘자 없음</span>
						<span className="cond-spacer" />
						<button className="btn-send" onClick={start} disabled={busy}>{busy ? '투입 중…' : '🎼 사용 (지휘자 투입)'}</button>
					</>
				)}
			</div>

			{status.active && status.session && (
				<>
					<div className="cond-term">
						<XTerm session={status.session} cwd="" />
					</div>

					{/* 함대 뷰 — 지휘자 허브 + 멤버 노드(모델·상태), 최근 대화 노드 점멸 */}
					<div className="cond-fleet">
						<div className="fleet-hub">
							🎼<span className={`model-badge m-${modelTag(status.model)}`}>{modelTag(status.model)}</span>
						</div>
						<div className="fleet-nodes">
							{members.map((m) => {
								const a = agentFor(m)
								const st = agentState(a?.status)
								const active = m.ticket && activeTickets.has(m.ticket)
								return (
									<button key={m.key} className={`fleet-node st-${st.c} ${active ? 'pulse' : ''}`} onClick={() => a && onToggleTerm(a.name)} title={a ? (openTerms.has(a.name) ? '터미널 접기' : '터미널 열기') : '서브에이전트 없음'}>
										<span className="fn-tk">{m.ticket || m.key}</span>
										<span className="fn-st">{st.t}</span>
										{a?.model && <span className={`model-badge m-${modelTag(a.model)}`}>{modelTag(a.model)}</span>}
										{!a && <span className="fn-none">—</span>}
									</button>
								)
							})}
						</div>
					</div>

					{/* 활동 피드 — 유기적 대화 타임라인 */}
					<div className="cond-feed">
						{feed.length === 0 && <div className="muted feed-empty">아직 조율 활동 없음 — 지휘자에게 지시하면 여기 대화가 흐릅니다.</div>}
						{feed.map((e, i) => (
							<div className={`feed-row k-${e.kind} from-${e.from === 'orch' ? 'orch' : e.from === '마티' ? 'me' : 'sub'}`} key={i}>
								<span className="fr-t">{new Date(e.ts).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit' })}</span>
								<span className="fr-who">{e.from === 'orch' ? '🎼' : e.from === '마티' ? '🧑' : '🤖' + e.from}</span>
								<span className="fr-arrow">→</span>
								<span className="fr-to">{e.to === 'orch' ? '🎼' : e.to === '마티' ? '🧑' : '🤖' + e.to}</span>
								<span className="fr-text">{e.text}</span>
							</div>
						))}
						<div ref={feedEnd} />
					</div>
				</>
			)}
		</div>
	)
}
