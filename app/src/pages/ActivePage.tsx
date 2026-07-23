import PageSkeleton from '../components/Skeleton'
import { useEffect, useRef, useState } from 'react'

interface Flag {
	level: 'high' | 'mid' | 'low'
	file: string
	msg: string
}
interface Item {
	file: string
	status: string
	usesApi: boolean
	apiCalls: { name: string; count: number }[]
	hooks: Record<string, number>
	flags: Flag[]
	test: 'exact' | 'sibling' | 'none' | 'na'
	needsTest: boolean
	verdict: 'ok' | 'warn' | 'bad'
	issues: string[]
	relatedTests: { file: string; cases: string[] }[]
}
interface Active {
	mode: string
	branch: string
	counts: { files: number; bad: number; warn: number; ok: number; apiFiles: number; missingTest: number }
	items: Item[]
	error?: string
}
interface Commit {
	hash: string
	author: string
	date: string
	subject: string
	changedCount: number
	touchedTest: boolean
	touchesUI: boolean
	touchesApi: boolean
	verdict: 'ok' | 'warn' | 'bad'
	issues: string[]
	items: Item[]
}
interface Commits {
	counts: { commits: number; bad: number; warn: number; ok: number; noTest: number }
	commits: Commit[]
	error?: string
}

const V_COLOR = { ok: '#3fb950', warn: '#d29922', bad: '#f85149' }
const FLAG_COLOR = { high: '#f85149', mid: '#d29922', low: '#8b949e' }
const TEST_LABEL: Record<string, { t: string; c: string }> = {
	exact: { t: '✓ 테스트 있음', c: '#3fb950' },
	sibling: { t: '~ 폴더에 테스트', c: '#58a6ff' },
	none: { t: '✗ 테스트 없음', c: '#f85149' },
	na: { t: '— 테스트 불요', c: '#8b949e' },
}
const MODES = [
	{ k: 'working', label: '지금 (미커밋)' },
	{ k: 'recent', label: '최근 3커밋' },
	{ k: 'branch', label: '브랜치 전체' },
]

function DiffView({ text }: { text: string }) {
	if (!text.trim()) return <p className="muted" style={{ fontSize: 12, margin: '4px 0' }}>표시할 diff 없음 (바이너리/대용량 또는 변경 없음)</p>
	const MAX = 500
	const all = text.split('\n')
	const lines = all.slice(0, MAX)
	const cls = (l: string) =>
		l.startsWith('@@') ? 'hunk'
		: l.startsWith('+++') || l.startsWith('---') || l.startsWith('diff ') || l.startsWith('index ') ? 'meta'
		: l.startsWith('+') ? 'add'
		: l.startsWith('-') ? 'del'
		: ''
	return (
		<pre className="diff">
			{lines.map((l, i) => (
				<div className={`dl ${cls(l)}`} key={i}>{l || ' '}</div>
			))}
			{all.length > MAX && <div className="dl meta">… {all.length - MAX}줄 더 (생략)</div>}
		</pre>
	)
}

function FileRow({ it, mode, commit }: { it: Item; mode?: string; commit?: string }) {
	const [open, setOpen] = useState(false)
	const [diff, setDiff] = useState<string | null>(null)
	const [loadingDiff, setLoadingDiff] = useState(false)
	const testCount = it.relatedTests.reduce((s, t) => s + t.cases.length, 0)

	const toggle = () => {
		const next = !open
		setOpen(next)
		if (next && diff === null) {
			setLoadingDiff(true)
			const qs = commit
				? `file=${encodeURIComponent(it.file)}&commit=${commit}`
				: `file=${encodeURIComponent(it.file)}&mode=${mode || 'working'}`
			fetch(`/api/active/diff?${qs}`)
				.then((r) => r.json())
				.then((d) => setDiff(d.diff || ''))
				.catch(() => setDiff(''))
				.finally(() => setLoadingDiff(false))
		}
	}

	return (
		<div className="act-row" style={{ borderLeftColor: V_COLOR[it.verdict] }}>
			<div className="act-head" onClick={toggle} style={{ cursor: 'pointer' }}>
				<span className="caret">{open ? '▾' : '▸'}</span>
				<span className="vbadge" style={{ background: V_COLOR[it.verdict] }}>
					{it.verdict}
				</span>
				<span className="gstatus">{it.status}</span>
				<code className="act-path">{it.file.replace(/^src\//, '')}</code>
				{testCount > 0 && <span className="tcount">🧪 {testCount}</span>}
				<span className="tbadge" style={{ color: TEST_LABEL[it.test].c }}>
					{TEST_LABEL[it.test].t}
				</span>
			</div>
			{(it.apiCalls.length > 0 || Object.values(it.hooks).some((v) => v > 0)) && (
				<div className="act-line">
					<span className="k">API</span>
					<div className="api-chips">
						{it.apiCalls.map((a) => (
							<span className="api-chip" key={a.name}>
								{a.name}
								<b>×{a.count}</b>
							</span>
						))}
						{Object.entries(it.hooks)
							.filter(([, v]) => v > 0)
							.map(([h, v]) => (
								<span className="api-chip alt" key={h}>
									{h}
									<b>×{v}</b>
								</span>
							))}
					</div>
				</div>
			)}
			{it.flags.map((f, i) => (
				<div className="act-flag" key={i}>
					<span className="lvl" style={{ background: FLAG_COLOR[f.level] }}>
						{f.level}
					</span>
					<span className="msg">{f.msg}</span>
				</div>
			))}
			{open && (
				<div className="act-detail">
					<div className="detail-h">변경 내용</div>
					{loadingDiff ? <p className="muted" style={{ fontSize: 12 }}>diff 로딩…</p> : <DiffView text={diff || ''} />}
					<div className="detail-h">
						🧪 이 파일의 테스트 {testCount > 0 ? `· ${testCount}케이스` : ''}
					</div>
					{it.relatedTests.length ? (
						it.relatedTests.map((t) => (
							<div className="test-block" key={t.file}>
								<code className="test-file">{t.file.replace(/^src\//, '')}</code>
								{t.cases.length ? (
									<ul className="cases">
										{t.cases.map((c, i) => (
											<li key={i}>✓ {c}</li>
										))}
									</ul>
								) : (
									<span className="muted"> (케이스 파싱 결과 없음)</span>
								)}
							</div>
						))
					) : (
						<p className="muted" style={{ fontSize: 12 }}>형제 테스트 파일 없음 — 검증 미동반</p>
					)}
				</div>
			)}
		</div>
	)
}

function BranchSwitcher({ current, onSwitched }: { current: string; onSwitched: () => void }) {
	const [open, setOpen] = useState(false)
	const [info, setInfo] = useState<{ list: string[]; dirty: boolean } | null>(null)
	const [busy, setBusy] = useState('')
	const [err, setErr] = useState('')
	const [q, setQ] = useState('')

	const toggle = () => {
		setErr('')
		setQ('')
		setOpen((o) => !o)
		if (!info)
			fetch('/api/branches')
				.then((r) => r.json())
				.then((d) => setInfo({ list: d.list || [], dirty: !!d.dirty }))
				.catch(() => {})
	}
	const filtered = (info?.list || []).filter((b) => b.toLowerCase().includes(q.trim().toLowerCase()))
	const switchTo = (b: string) => {
		if (b === current) return setOpen(false)
		setBusy(b)
		setErr('')
		fetch('/api/checkout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ branch: b }),
		})
			.then((r) => r.json())
			.then((r) => {
				if (r.ok) {
					setOpen(false)
					setInfo(null)
					onSwitched()
				} else setErr(r.error || 'checkout 실패')
			})
			.catch(() => setErr('요청 실패'))
			.finally(() => setBusy(''))
	}

	return (
		<span className="branch-switch">
			<button className="branch-btn" onClick={toggle} title="브랜치 전환">
				⎇ {current || '—'} <span className="caret">▾</span>
			</button>
			{open && (
				<div className="branch-menu">
					{info?.dirty && <div className="branch-warn">⚠ 미커밋 변경 있음 — 충돌 시 git 이 전환을 거부합니다</div>}
					{!info && <div className="muted" style={{ padding: 8, fontSize: 12 }}>브랜치 로딩…</div>}
					{info && (
						<input
							className="branch-search"
							value={q}
							onChange={(e) => setQ(e.target.value)}
							placeholder={`🔍 브랜치 검색 (${info.list.length})`}
							autoFocus
						/>
					)}
					{info && filtered.length === 0 && <div className="muted" style={{ padding: 8, fontSize: 12 }}>일치하는 브랜치 없음</div>}
					{filtered.map((b) => (
						<button
							key={b}
							className={`branch-item ${b === current ? 'on' : ''}`}
							disabled={!!busy}
							onClick={() => switchTo(b)}
						>
							{b === current ? '● ' : '○ '}
							{b}
							{busy === b && ' …'}
						</button>
					))}
					{err && <div className="branch-err">✗ {err}</div>}
				</div>
			)}
		</span>
	)
}

export default function ActivePage() {
	const [axis, setAxis] = useState<'changes' | 'commits'>('changes')
	const [data, setData] = useState<Active | null>(null)
	const [commits, setCommits] = useState<Commits | null>(null)
	const [mode, setMode] = useState('working')
	const [loading, setLoading] = useState(true)
	const [live, setLive] = useState(false)
	const [openCommit, setOpenCommit] = useState<string | null>(null)
	const modeRef = useRef(mode)
	modeRef.current = mode
	const axisRef = useRef(axis)
	axisRef.current = axis

	const load = (m: string) => {
		setLoading(true)
		fetch(`/api/active?mode=${m}`)
			.then((r) => r.json())
			.then(setData)
			.catch(() => {})
			.finally(() => setLoading(false))
	}
	const loadCommits = () => {
		setLoading(true)
		fetch('/api/commits?n=15')
			.then((r) => r.json())
			.then(setCommits)
			.catch(() => {})
			.finally(() => setLoading(false))
	}
	useEffect(() => {
		if (axis === 'changes') load(mode)
		else loadCommits()
	}, [axis, mode])

	// 워킹트리 변경 시 자동 갱신
	useEffect(() => {
		const es = new EventSource('/api/active/stream')
		es.onopen = () => setLive(true)
		es.onerror = () => setLive(false)
		es.onmessage = () => (axisRef.current === 'changes' ? load(modeRef.current) : loadCommits())
		return () => es.close()
	}, [])

	return (
		<>
			<div className="page-head">
				<h1>🛠️ 개발중</h1>
				<span className="feat">
					{data?.branch && <BranchSwitcher current={data.branch} onSwitched={() => load(mode)} />}
					{' · '}내가 시킨 UI·API가 잘 적용됐는지 검증
				</span>
				<div className="toolbar">
					<span className="chip" title="파일 저장 시 자동 갱신">
						<span className={`conn ${live ? 'live' : ''}`} />
						{live ? '자동' : 'off'}
					</span>
				</div>
			</div>

			{/* 축 토글: 변경 단위 vs 커밋 단위 */}
			<div className="axis-toggle">
				<button className={axis === 'changes' ? 'on' : ''} onClick={() => setAxis('changes')}>
					📝 변경 단위
				</button>
				<button className={axis === 'commits' ? 'on' : ''} onClick={() => setAxis('commits')}>
					⊙ 커밋 단위
				</button>
				<div className="toolbar" style={{ marginLeft: 'auto' }}>
					{axis === 'changes' &&
						MODES.map((m) => (
							<button key={m.k} className={mode === m.k ? 'on' : ''} onClick={() => setMode(m.k)}>
								{m.label}
							</button>
						))}
					<button onClick={() => (axis === 'changes' ? load(mode) : loadCommits())}>↻</button>
				</div>
			</div>

			{/* ── 변경 단위 ── */}
			{axis === 'changes' && (
				<>
					{data?.error && <div className="err">⚠️ {data.error}</div>}
					{data && (
						<div className="kpis">
							<div className="kpi">
								<div className="v">{data.counts.files}</div>
								<div className="l">변경 파일</div>
							</div>
							<div className={`kpi ${data.counts.bad ? 'warn' : ''}`}>
								<div className="v" style={{ color: data.counts.bad ? V_COLOR.bad : undefined }}>
									{data.counts.bad}
								</div>
								<div className="l">🔴 API 오용</div>
							</div>
							<div className={`kpi ${data.counts.missingTest ? 'warn' : ''}`}>
								<div className="v">{data.counts.missingTest}</div>
								<div className="l">테스트 빠짐</div>
							</div>
							<div className="kpi">
								<div className="v">{data.counts.apiFiles}</div>
								<div className="l">API 쓰는 파일</div>
							</div>
							<div className="kpi">
								<div className="v" style={{ color: V_COLOR.ok }}>
									{data.counts.ok}
								</div>
								<div className="l">🟢 이상 없음</div>
							</div>
						</div>
					)}
					{loading && !data && <PageSkeleton head={false} kpis={6} rows={6} />}
					{data && !data.items.length && (
						<div className="placeholder">
							<div className="big">✨</div>
							<h3>변경 없음</h3>
							<p>이 모드에서 추적할 변경 파일이 없어요.</p>
						</div>
					)}
					{data?.items.map((it) => (
						<FileRow key={it.file} it={it} mode={mode} />
					))}
				</>
			)}

			{/* ── 커밋 단위 ── */}
			{axis === 'commits' && (
				<>
					{commits?.error && <div className="err">⚠️ {commits.error}</div>}
					{commits && (
						<div className="kpis">
							<div className="kpi">
								<div className="v">{commits.counts.commits}</div>
								<div className="l">최근 커밋</div>
							</div>
							<div className={`kpi ${commits.counts.bad ? 'warn' : ''}`}>
								<div className="v" style={{ color: commits.counts.bad ? V_COLOR.bad : undefined }}>
									{commits.counts.bad}
								</div>
								<div className="l">🔴 오용 포함</div>
							</div>
							<div className={`kpi ${commits.counts.noTest ? 'warn' : ''}`}>
								<div className="v">{commits.counts.noTest}</div>
								<div className="l">UI인데 테스트 미동반</div>
							</div>
							<div className="kpi">
								<div className="v" style={{ color: V_COLOR.ok }}>
									{commits.counts.ok}
								</div>
								<div className="l">🟢 깔끔</div>
							</div>
						</div>
					)}
					{loading && !commits && <div className="muted">커밋 분석 중…</div>}
					{commits?.commits.map((c) => (
						<div className="commit-card" key={c.hash} style={{ borderLeftColor: V_COLOR[c.verdict] }}>
							<div
								className="commit-head"
								onClick={() => setOpenCommit(openCommit === c.hash ? null : c.hash)}
							>
								<span className="caret">{openCommit === c.hash ? '▾' : '▸'}</span>
								<span className="vbadge" style={{ background: V_COLOR[c.verdict] }}>
									{c.verdict}
								</span>
								<code className="chash">{c.hash}</code>
								{c.touchesUI && <span className="tag-ui">UI</span>}
								{c.touchesApi && <span className="tag-api">API</span>}
								{c.touchedTest ? (
									<span className="tag-test">+test</span>
								) : (
									c.touchesUI && <span className="tag-notest">no test</span>
								)}
								<span className="csubject">{c.subject}</span>
								{!!c.issues.length && <span className="flag">⚠️ {c.issues.join(', ')}</span>}
								<span className="cmeta">
									{c.author} · {c.date}
								</span>
							</div>
							{openCommit === c.hash && (
								<div className="commit-body">
									{c.items.length ? (
										c.items.map((it) => <FileRow key={it.file} it={it} commit={c.hash} />)
									) : (
										<p className="muted" style={{ fontSize: 12 }}>
											검증 대상 .ts/.tsx 변경 없음
										</p>
									)}
								</div>
							)}
						</div>
					))}
				</>
			)}

			<div className="callout-box" style={{ marginTop: 16 }}>
				🎯 <b>"내가 시킨 게 잘 적용됐나"</b> — <b>변경 단위</b>는 지금 만지는 코드를, <b>커밋 단위</b>는 "이
				커밋(=시킨 일)이 API·UI를 제대로 적용했나"를 본다. 커밋 메시지=의도, diff=실행, 색=품질 판정.
			</div>
		</>
	)
}
