import PageSkeleton from '../components/Skeleton'
import { useEffect, useMemo, useState } from 'react'

interface PR {
	number: number
	repo: string
	title: string
	branch: string
	base: string
	state: 'OPEN' | 'MERGED' | 'CLOSED'
	draft: boolean
	review: string | null
	ci: 'pass' | 'fail' | 'pending' | 'none'
	additions: number
	deletions: number
	files: number
	url: string
	updatedAt: string
	ticket: string | null
	worktree: string | null
}
interface CodeItem {
	file: string
	verdict: 'ok' | 'warn' | 'bad'
	test: 'exact' | 'sibling' | 'none' | 'na'
	relatedTests: { file: string; cases: string[] }[]
	issues: string[]
}
interface Detail {
	number: number
	repo?: string
	title: string
	branch: string
	base: string
	state: string
	url: string
	ticket: string | null
	worktree: string | null
	prFiles: { path: string; additions: number; deletions: number }[]
	code: { counts: { files: number; bad: number; warn: number; ok: number; missingTest: number }; items: CodeItem[] } | null
	figmaNodes: string[]
	error?: string
}

interface PrList {
	state?: string
	repos?: string[]
	byRepo?: Record<string, number>
	counts?: Record<string, number>
	prs: PR[]
	builtAt?: string
	error?: string
}
const prKey = (p: PR) => `${p.repo}#${p.number}`
type Tab = 'open' | 'merged' | 'closed'
const TAB_LABEL: Record<Tab, string> = { open: '열림+드래프트', merged: '머지', closed: '닫힘' }

const V = { ok: '#3fb950', warn: '#d29922', bad: '#f85149' }
const REVIEW_C: Record<string, string> = { APPROVED: 'var(--green)', CHANGES_REQUESTED: 'var(--red)', REVIEW_REQUIRED: 'var(--yellow)' }

export default function PrsPage() {
	const [tab, setTab] = useState<Tab>('open')
	const [byState, setByState] = useState<Record<string, PrList | 'loading'>>({})
	const [q, setQ] = useState('')
	const [open, setOpen] = useState<string | null>(null) // prKey
	const [detail, setDetail] = useState<Record<string, Detail | 'loading'>>({})
	const [figImgs, setFigImgs] = useState<Record<string, Record<string, string | null>>>({}) // prKey → node → url

	// state별 lazy 로드 — 기본 open만, merged/closed는 탭 누를 때만 gh 호출
	const fetchState = (st: Tab, force = false) => {
		if (!force && byState[st]) return
		setByState((m) => ({ ...m, [st]: 'loading' }))
		fetch(`/api/prs?state=${st}`)
			.then((r) => r.json())
			.then((d) => setByState((m) => ({ ...m, [st]: d })))
			.catch(() => setByState((m) => ({ ...m, [st]: { prs: [], error: 'fetch 실패' } })))
	}
	useEffect(() => fetchState('open'), [])
	const switchTab = (st: Tab) => {
		setTab(st)
		setOpen(null)
		fetchState(st)
	}

	const cur = byState[tab]
	const rows = useMemo(() => {
		if (!cur || cur === 'loading' || !cur.prs) return []
		const s = q.trim().toLowerCase()
		return cur.prs.filter(
			(p) => !s || p.title.toLowerCase().includes(s) || p.branch.toLowerCase().includes(s) || String(p.number).includes(s) || (p.ticket || '').toLowerCase().includes(s) || p.repo.toLowerCase().includes(s),
		)
	}, [cur, q])

	const toggle = (p: PR) => {
		const k = prKey(p)
		const next = open === k ? null : k
		setOpen(next)
		if (next && !detail[k]) {
			setDetail((d) => ({ ...d, [k]: 'loading' }))
			fetch(`/api/prs/detail?n=${p.number}&repo=${encodeURIComponent(p.repo)}`)
				.then((r) => r.json())
				.then((det: Detail) => {
					setDetail((d) => ({ ...d, [k]: det }))
					if (det.figmaNodes?.length) {
						fetch(`/api/figma?nodes=${encodeURIComponent(det.figmaNodes.join(','))}`)
							.then((r) => r.json())
							.then((f) => setFigImgs((m) => ({ ...m, [k]: f.images || {} })))
							.catch(() => {})
					}
				})
				.catch(() => setDetail((d) => ({ ...d, [k]: { error: 'fetch 실패' } as Detail })))
		}
	}

	const openState = byState['open']
	if (!openState || openState === 'loading') return <PageSkeleton kpis={4} rows={6} />
	if (openState.error) return <div className="muted" style={{ padding: 16 }}>⚠ {openState.error} (gh 인증 확인)</div>
	const c: Record<string, number> = (cur && cur !== 'loading' && cur.counts) || {}

	// 레포별 그룹 (rows는 백엔드에서 repo→updatedAt 정렬됨)
	const grouped: [string, PR[]][] = []
	for (const p of rows) {
		const g = grouped.find((x) => x[0] === p.repo)
		if (g) g[1].push(p)
		else grouped.push([p.repo, [p]])
	}

	return (
		<div className="dc-page w1160">
			<div className="dc-pghead"><span className="t">내 PR</span><span className="s">기본은 열림 + 드래프트 · 레포별로 묶음</span></div>

			<div className="dc-strip">
				<div className="cell"><div className="num">{c.total ?? 0}</div><div className="lbl">열림 + 드래프트</div></div>
				<div className="cell"><div className="num">{c.draft ?? 0}</div><div className="lbl">드래프트</div></div>
				<div className="cell"><div className="num green">{c.approved ?? 0}</div><div className="lbl">승인됨</div></div>
				<div className="cell"><div className={`num ${(c.ciFail || 0) > 0 ? 'yellow' : ''}`}>{c.ciFail ?? 0}</div><div className="lbl">CI 실패</div></div>
			</div>

			<div className="dc-filters">
				{(['open', 'merged', 'closed'] as Tab[]).map((st) => {
					const sd = byState[st]
					const n = sd && sd !== 'loading' ? sd.prs.length : null
					return (
						<button key={st} className={`dc-fchip ${tab === st ? 'on' : ''}`} onClick={() => switchTab(st)}>
							{TAB_LABEL[st]}{sd === 'loading' ? ' …' : n != null ? ` ${n}` : ''}
						</button>
					)
				})}
				<div className="dc-search">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.9"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" strokeLinecap="round" /></svg>
					<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="PR번호 · 제목 · 브랜치" />
				</div>
			</div>

			{cur === 'loading' && <p className="muted" style={{ padding: 8 }}>{TAB_LABEL[tab]} PR 불러오는 중…</p>}
			{cur && cur !== 'loading' && cur.error && <p className="muted" style={{ padding: 8 }}>⚠ {cur.error}</p>}

			{grouped.map(([repoName, list]) => (<div key={repoName} style={{ marginTop: 20 }}><div className="dc-sec"><span className="emoji">📦</span><span className="lbl mono">{repoName}</span><span className="cnt">{list.length}</span><span className="line" /></div><div className="dc-list g1">{list.map((p) => {
				const d = detail[prKey(p)]
				const imgs = figImgs[prKey(p)] || {}
				const rdot = p.draft ? 'var(--muted)' : p.review === 'APPROVED' ? 'var(--green)' : p.review === 'CHANGES_REQUESTED' ? 'var(--red)' : 'var(--yellow)'
				return (
					<div key={prKey(p)}>
						<div className="dc-row" onClick={() => toggle(p)}>
							<span className="rdot" style={{ background: rdot }} />
							<span className="rnum">#{p.number}</span>
							<span className="rtitle">{p.title}</span>
							{p.review && <span style={{ fontSize: 11, fontWeight: 600, flex: 'none', color: REVIEW_C[p.review] || 'var(--muted)' }}>{p.review === 'APPROVED' ? '✓ 승인' : p.review === 'CHANGES_REQUESTED' ? '✗ 변경요청' : '리뷰 대기'}</span>}
							{p.ci === 'fail' && <span style={{ fontSize: 11, fontWeight: 600, flex: 'none', color: 'var(--red)' }}>CI ✗</span>}
							<span className="rmeta w100">+{p.additions}/-{p.deletions}</span>
						</div>
						{open === prKey(p) && (
							<div className="wt-detail">
								{d === 'loading' || !d ? (
									<p className="muted" style={{ fontSize: 12 }}>대조 데이터 불러오는 중…</p>
								) : d.error ? (
									<p className="muted" style={{ fontSize: 12 }}>⚠ {d.error}</p>
								) : (
									<>
										<div className="pr-meta-row">
											<a href={d.url} target="_blank" rel="noreferrer" className="figma-open">GitHub PR ↗</a>
											<span className="muted">{d.branch} → {d.base}</span>
											{d.worktree && <span className="muted">· 워크트리 {d.worktree.split('/').pop()}</span>}
										</div>
										<div className="compare-grid">
											{/* 코드 */}
											<div className="compare-col">
												<div className="compare-col-head">
													<span className="cc-title">
														💻 코드 {d.code ? `· ${d.code.counts.files}파일 · ` : ''}
														{d.code && <><span style={{ color: V.bad }}>bad {d.code.counts.bad}</span> · <span style={{ color: V.warn }}>warn {d.code.counts.warn}</span> · 테스트빠짐 {d.code.counts.missingTest}</>}
													</span>
												</div>
												{d.code ? (
													d.code.items.map((it) => (
														<div className="wt-file" key={it.file}>
															<span className="vbadge" style={{ background: V[it.verdict] }}>{it.verdict}</span>
															<code className="act-path">{it.file.replace(/^src\//, '')}</code>
															{it.issues.length > 0 && <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>{it.issues.join(', ')}</span>}
														</div>
													))
												) : (
													<>
														<p className="muted" style={{ fontSize: 12 }}>워크트리 없음(머지·삭제됨) — 변경 파일만:</p>
														{d.prFiles.slice(0, 40).map((f) => (
															<div className="wt-file" key={f.path}>
																<code className="act-path">{f.path.replace(/^src\//, '')}</code>
																<span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>+{f.additions}/-{f.deletions}</span>
															</div>
														))}
													</>
												)}
											</div>
											{/* 화면 */}
											<div className="compare-col">
												<div className="compare-col-head"><span className="cc-title">🎨 화면 (Figma {d.figmaNodes.length})</span></div>
												{d.figmaNodes.length ? (
													<div className="pr-figma">
														{d.figmaNodes.map((n) => (
															imgs[n] ? (
																<img key={n} src={imgs[n] as string} alt={n} className="pr-figma-thumb" />
															) : (
																<span key={n} className="api-chip sm">{n}</span>
															)
														))}
													</div>
												) : (
													<p className="muted" style={{ fontSize: 12 }}>
														이 PR 티켓({d.ticket || '—'})에 연결된 figmaNodes 없음. 아키텍처 탭에서 Storybook 대조 가능.
													</p>
												)}
											</div>
										</div>
									</>
								)}
							</div>
						)}
					</div>
				)
			})}
					</div></div>
			))}
			{cur && cur !== 'loading' && !cur.error && !rows.length && <p className="muted" style={{ padding: '14px 2px' }}>{TAB_LABEL[tab]} PR 없음.</p>}

			<div className="prompt-out" style={{ marginTop: 16 }}>
				<span className="muted" style={{ fontSize: 12 }}>코드 verdict = PR 변경 파일 분석 · 화면 = 티켓 figmaNodes · GitHub로 실물 diff</span>
				<span className="fresh" style={{ marginLeft: 'auto' }}>{cur && cur !== 'loading' ? cur.builtAt?.replace('T', ' ').slice(0, 19) : ''}</span>
			</div>
		</div>
	)
}
