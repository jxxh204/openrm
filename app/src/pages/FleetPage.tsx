import PageSkeleton from '../components/Skeleton'
import { useEffect, useMemo, useState } from 'react'

interface WT {
	path: string
	name: string
	branch: string
	ticket: string | null
	head: string | null
	dirty: number
	dirtySrc: number
	lastRel: string | null
	lastSubject: string | null
	author: string | null
	lastTs: number
	ahead: number
	behind: number
	isMain: boolean
}
interface Fleet {
	base: string
	count: number
	worktrees: WT[]
	builtAt: string
	error?: string
}
interface ActiveItem {
	file: string
	status: string
	verdict: 'ok' | 'warn' | 'bad'
	test: 'exact' | 'sibling' | 'none' | 'na'
	issues: string[]
	relatedTests: { file: string; cases: string[] }[]
	flags: { level: 'high' | 'mid' | 'low'; msg: string }[]
}
interface Active {
	branch: string
	worktree: string | null
	counts: { files: number; bad: number; warn: number; ok: number; missingTest: number }
	items: ActiveItem[]
	error?: string
}

const V = { ok: '#3fb950', warn: '#d29922', bad: '#f85149' }
const TEST_C: Record<string, string> = { exact: '#3fb950', sibling: '#58a6ff', none: '#f85149', na: '#8b949e' }

export default function FleetPage() {
	const [fleet, setFleet] = useState<Fleet | null>(null)
	const [q, setQ] = useState('')
	const [filter, setFilter] = useState<'all' | 'dirty'>('all')
	const [open, setOpen] = useState<string | null>(null)
	const [detail, setDetail] = useState<Record<string, Active | 'loading'>>({})

	const load = () => {
		setFleet(null)
		fetch('/api/worktrees')
			.then((r) => r.json())
			.then(setFleet)
			.catch(() => {})
	}
	useEffect(load, [])

	const rows = useMemo(() => {
		if (!fleet) return []
		const s = q.trim().toLowerCase()
		return fleet.worktrees.filter(
			(w) =>
				(filter === 'all' || w.dirty > 0) &&
				(!s || w.branch.toLowerCase().includes(s) || w.name.toLowerCase().includes(s) || (w.lastSubject || '').toLowerCase().includes(s)),
		)
	}, [fleet, q, filter])

	const toggle = (w: WT) => {
		const next = open === w.path ? null : w.path
		setOpen(next)
		if (next && !detail[w.path]) {
			setDetail((d) => ({ ...d, [w.path]: 'loading' }))
			fetch(`/api/active?repo=${encodeURIComponent(w.path)}`)
				.then((r) => r.json())
				.then((a) => setDetail((d) => ({ ...d, [w.path]: a })))
				.catch(() => setDetail((d) => ({ ...d, [w.path]: { branch: '', worktree: null, counts: { files: 0, bad: 0, warn: 0, ok: 0, missingTest: 0 }, items: [], error: 'fetch 실패' } })))
		}
	}

	if (!fleet) return <PageSkeleton kpis={3} rows={8} />
	if (fleet.error) return <div className="muted" style={{ padding: 16 }}>⚠ {fleet.error}</div>

	const dirtyCount = fleet.worktrees.filter((w) => w.dirty > 0).length

	return (
		<div className="dc-page w1160">
			<div className="dc-pghead"><span className="t">플릿</span><span className="s">git 워크트리 — 티켓별 격리 작업장</span></div>

			<div className="dc-strip">
				<div className="cell"><div className="num">{fleet.count}</div><div className="lbl">워크트리</div></div>
				<div className="cell"><div className="num yellow">{dirtyCount}</div><div className="lbl">미커밋 있는 곳</div></div>
				<div className="cell"><div className="num">{fleet.worktrees.filter((w) => w.ahead > 0).length}</div><div className="lbl">base보다 앞선 곳</div></div>
				<div className="cell wide"><div className="num mono">🚀 {fleet.base.split('/').pop()}</div><div className="lbl">기준 브랜치</div></div>
			</div>

			<div className="dc-filters">
				<button className={`dc-fchip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>전체 {fleet.count}</button>
				<button className={`dc-fchip ${filter === 'dirty' ? 'on' : ''}`} onClick={() => setFilter('dirty')}>미커밋만 {dirtyCount}</button>
				<div className="dc-search">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.9"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" strokeLinecap="round" /></svg>
					<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="티켓 · 브랜치 · 커밋 메시지" />
				</div>
			</div>

			<div className="dc-list g1">
			{rows.map((w) => {
				const d = detail[w.path]
				return (
					<div key={w.path}>
						<div className="dc-row" onClick={() => toggle(w)}>
							<span className="rdot" style={{ background: w.dirty > 0 ? 'var(--yellow)' : 'var(--muted)' }} />
							<span className="rbranch">{w.branch}{w.isMain ? ' (main)' : ''}</span>
							<span className="rmsg">{w.lastSubject || '—'}</span>
							{w.dirty > 0 && <span className="rmeta">±{w.dirty}</span>}
							<span className="rmeta w96">{w.lastRel || ''}</span>
							<div className="rtools">
								<a className="dc-btn-sm" href={`vscode://file${encodeURI(w.path)}`} onClick={(e) => e.stopPropagation()} title="VSCode로 열기">열기</a>
								<button onClick={(e) => { e.stopPropagation(); toggle(w) }}>검증</button>
							</div>
						</div>
						{open === w.path && (
							<div className="wt-detail">
								{d === 'loading' || !d ? (
									<p className="muted" style={{ fontSize: 12 }}>검증 중…</p>
								) : d.error ? (
									<p className="muted" style={{ fontSize: 12 }}>⚠ {d.error}</p>
								) : !d.items.length ? (
									<p className="muted" style={{ fontSize: 12 }}>미커밋 src 변경 없음 (커밋됨/클린).</p>
								) : (
									<>
										<div className="wt-detail-h">
											변경 {d.counts.files} · <span style={{ color: V.bad }}>bad {d.counts.bad}</span> · <span style={{ color: V.warn }}>warn {d.counts.warn}</span> · 테스트빠짐 {d.counts.missingTest}
										</div>
										{d.items.map((it) => (
											<div className="wt-file" key={it.file}>
												<span className="vbadge" style={{ background: V[it.verdict] }}>{it.verdict}</span>
												<span className="gstatus">{it.status}</span>
												<code className="act-path">{it.file.replace(/^src\//, '')}</code>
												{it.relatedTests.reduce((s, t) => s + t.cases.length, 0) > 0 && (
													<span className="tcount">🧪 {it.relatedTests.reduce((s, t) => s + t.cases.length, 0)}</span>
												)}
												<span className="tbadge" style={{ color: TEST_C[it.test], marginLeft: 'auto' }}>
													{it.test === 'none' ? '✗ 테스트 없음' : it.test === 'na' ? '—' : '✓ 테스트'}
												</span>
											</div>
										))}
									</>
								)}
							</div>
						)}
					</div>
				)
			})}
			{!rows.length && <p className="muted" style={{ padding: '14px 2px' }}>조건에 맞는 워크트리 없음.</p>}
			</div>

			<div className="prompt-out" style={{ marginTop: 16 }}>
				<span className="muted" style={{ fontSize: 12 }}>● 미커밋 · 클릭 → 그 워크트리 개발중 검증 (체크아웃 없이 비파괴)</span>
				<span className="fresh" style={{ marginLeft: 'auto' }}>{fleet.builtAt.replace('T', ' ').slice(0, 19)}</span>
			</div>
		</div>
	)
}
