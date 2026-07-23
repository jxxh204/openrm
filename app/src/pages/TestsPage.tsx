import PageSkeleton from '../components/Skeleton'
import { useEffect, useMemo, useState } from 'react'

interface TItem {
	file: string
	area: string
	type: string
	suite: string
	cases: string[]
	caseCount: number
}
interface Gap {
	file: string
	kind: 'page' | 'component'
	area: string
}
interface Inventory {
	counts: { files: number; cases: number; areas: number; gaps: number; byType: Record<string, number> }
	byArea: { area: string; files: number }[]
	items: TItem[]
	gaps: Gap[]
	coverage: { lines?: { pct: number }; statements?: { pct: number } } | null
	builtAt: string
	error?: string
}

const TYPE_COLOR: Record<string, string> = { component: '#3fb950', unit: '#58a6ff', hook: '#d29922', e2e: '#a855f7' }

export default function TestsPage() {
	const [inv, setInv] = useState<Inventory | null>(null)
	const [tab, setTab] = useState<'verified' | 'gaps'>('verified')
	const [q, setQ] = useState('')
	const [domain, setDomain] = useState<string | null>(null) // 도메인(영역) 필터
	const [openFile, setOpenFile] = useState<string | null>(null)

	useEffect(() => {
		fetch('/api/tests')
			.then((r) => r.json())
			.then(setInv)
			.catch(() => {})
	}, [])

	// 현재 탭 데이터 기준 도메인(영역) 목록 + 개수
	const domains = useMemo(() => {
		if (!inv) return []
		const src = tab === 'verified' ? inv.items.map((i) => i.area) : inv.gaps.map((g) => g.area)
		const m: Record<string, number> = {}
		for (const a of src) m[a] = (m[a] || 0) + 1
		return Object.entries(m).sort((a, b) => b[1] - a[1])
	}, [inv, tab])

	const filtered = useMemo(() => {
		if (!inv) return []
		const s = q.trim().toLowerCase()
		return inv.items.filter((i) => {
			if (domain && i.area !== domain) return false
			if (!s) return true
			return (
				i.file.toLowerCase().includes(s) ||
				i.suite.toLowerCase().includes(s) ||
				i.cases.some((c) => c.toLowerCase().includes(s))
			)
		})
	}, [inv, q, domain])

	// 영역별 그룹
	const grouped = useMemo(() => {
		const g: Record<string, TItem[]> = {}
		for (const it of filtered) (g[it.area] = g[it.area] || []).push(it)
		return Object.entries(g).sort((a, b) => b[1].length - a[1].length)
	}, [filtered])

	const gapsByArea = useMemo(() => {
		if (!inv) return []
		const g: Record<string, Gap[]> = {}
		for (const gp of inv.gaps) {
			if (domain && gp.area !== domain) continue
			;(g[gp.area] = g[gp.area] || []).push(gp)
		}
		return Object.entries(g).sort((a, b) => b[1].length - a[1].length)
	}, [inv, domain])

	if (!inv)
		return (
			<PageSkeleton kpis={5} rows={7} />
		)

	return (
		<>
			<div className="page-head">
				<h1>✅ 테스트</h1>
				<span className="feat">어느 페이지에 무엇이 검증되는지 · describe/it = 검증 항목</span>
			</div>

			<div className="kpis">
				<div className="kpi">
					<div className="v">{inv.counts.files}</div>
					<div className="l">테스트 파일</div>
				</div>
				<div className="kpi">
					<div className="v">{inv.counts.cases.toLocaleString()}</div>
					<div className="l">검증 케이스 (it/test)</div>
				</div>
				<div className="kpi">
					<div className="v">{inv.counts.areas}</div>
					<div className="l">영역(페이지군)</div>
				</div>
				<div className={`kpi ${inv.counts.gaps > 0 ? 'warn' : ''}`}>
					<div className="v">{inv.counts.gaps}</div>
					<div className="l">미검증 (테스트 없는 화면)</div>
				</div>
				{inv.coverage?.lines && (
					<div className="kpi">
						<div className="v">
							{inv.coverage.lines.pct}
							<small>%</small>
						</div>
						<div className="l">라인 커버리지</div>
					</div>
				)}
			</div>
			<div className="api-chips" style={{ margin: '4px 0 12px' }}>
				{Object.entries(inv.counts.byType).map(([t, n]) => (
					<span className="api-chip" key={t} style={{ color: TYPE_COLOR[t] }}>
						{t}
						<b>×{n}</b>
					</span>
				))}
			</div>

			<div className="tabs2">
				<button className={tab === 'verified' ? 'on' : ''} onClick={() => setTab('verified')}>
					검증 항목 ({inv.counts.files})
				</button>
				<button className={tab === 'gaps' ? 'on' : ''} onClick={() => setTab('gaps')}>
					미검증 갭 ({inv.counts.gaps})
				</button>
			</div>

			<div className="domain-filter">
				<button className={`dchip ${domain === null ? 'on' : ''}`} onClick={() => setDomain(null)}>
					전체 <b>{domains.reduce((s, [, n]) => s + n, 0)}</b>
				</button>
				{domains.map(([a, n]) => (
					<button
						key={a}
						className={`dchip ${domain === a ? 'on' : ''}`}
						onClick={() => setDomain(domain === a ? null : a)}
						title={a}
					>
						{a.startsWith('domains/') ? a.slice('domains/'.length) : a} <b>{n}</b>
					</button>
				))}
			</div>

			{tab === 'verified' && (
				<>
					<input
						className="search"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="검증 항목/파일 검색 (예: 발송, 토글, 렌더)"
					/>
					{grouped.map(([area, items]) => (
						<div className="area-group" key={area}>
							<h3 className="area-h">
								📂 {area}{' '}
								<span className="muted">
									· {items.length}파일 · {items.reduce((s, i) => s + i.caseCount, 0)}케이스
								</span>
							</h3>
							{items.map((it) => (
								<div className="tfile" key={it.file}>
									<div
										className="tfile-head"
										onClick={() => setOpenFile(openFile === it.file ? null : it.file)}
									>
										<span className="caret">{openFile === it.file ? '▾' : '▸'}</span>
										<span className="lvl" style={{ background: TYPE_COLOR[it.type] || '#8b949e' }}>
											{it.type}
										</span>
										<b>{it.suite}</b>
										<code className="tpath">{it.file.replace(area + '/', '')}</code>
										<span className="cc2">{it.caseCount}개</span>
									</div>
									{openFile === it.file && (
										<ul className="cases">
											{it.cases.length ? (
												it.cases.map((c, i) => <li key={i}>✓ {c}</li>)
											) : (
												<li className="muted">case 파싱 결과 없음 (동적 생성 추정)</li>
											)}
										</ul>
									)}
								</div>
							))}
						</div>
					))}
					{!grouped.length && <p className="muted">검색 결과 없음.</p>}
				</>
			)}

			{tab === 'gaps' && (
				<>
					<p className="muted" style={{ fontSize: 13 }}>
						아래 페이지/컴포넌트는 형제 테스트 파일이 없음 — <b>검증 안 됨</b>. (mock·스토리 제외)
					</p>
					{gapsByArea.map(([area, gaps]) => (
						<div className="area-group" key={area}>
							<h3 className="area-h">
								📂 {area} <span className="flag">· 미검증 {gaps.length}</span>
							</h3>
							{gaps.map((g) => (
								<div className="flag-row" key={g.file}>
									<span
										className="lvl"
										style={{ background: g.kind === 'page' ? '#f0883e' : '#8b949e' }}
									>
										{g.kind}
									</span>
									<code>{g.file.replace(area + '/', '')}</code>
								</div>
							))}
						</div>
					))}
				</>
			)}

			<div className="prompt-out" style={{ marginTop: 16 }}>
				<span className="muted" style={{ fontSize: 12 }}>
					전체 테스트 실행:
				</span>
				<pre className="cmd">yarn test</pre>
				<button className="btn" onClick={() => navigator.clipboard?.writeText('yarn test')}>
					복사
				</button>
				<span className="fresh" style={{ marginLeft: 'auto' }}>
					빌드 {inv.builtAt.replace('T', ' ').slice(0, 19)}
				</span>
			</div>
		</>
	)
}
