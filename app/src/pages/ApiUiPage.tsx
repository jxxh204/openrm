import PageSkeleton from '../components/Skeleton'
import { useEffect, useMemo, useState } from 'react'

interface ApiCall {
	name: string
	count: number
}
interface Flag {
	level: 'high' | 'mid' | 'low'
	file: string
	msg: string
}
interface Screen {
	file: string
	area: string
	component: string
	label: string | null
	kind: 'component' | 'query-layer' | 'logic'
	apiCalls: ApiCall[]
	hooks: Record<string, number>
	flags: Flag[]
	raw: boolean
}
interface Endpoint {
	name: string
	count: number
	screens: { file: string; component: string; label: string | null }[]
}
interface ApiUi {
	repo: string
	screens: Screen[]
	endpoints: Endpoint[]
	counts: Record<string, number>
	builtAt: string
	error?: string
}

const KIND = {
	component: { c: '#3fb950', t: 'UI' },
	'query-layer': { c: '#58a6ff', t: 'query' },
	logic: { c: '#8b949e', t: 'logic' },
} as const
const FLAG_C = { high: '#f85149', mid: '#d29922', low: '#8b949e' } as Record<string, string>

export default function ApiUiPage() {
	const [d, setD] = useState<ApiUi | null>(null)
	const [tab, setTab] = useState<'screens' | 'endpoints'>('screens')
	const [q, setQ] = useState('')
	const [open, setOpen] = useState<string | null>(null)

	useEffect(() => {
		fetch('/api/apiui')
			.then((r) => r.json())
			.then(setD)
			.catch(() => {})
	}, [])

	const s = q.trim().toLowerCase()
	const hit = (...parts: (string | null | undefined)[]) => !s || parts.some((p) => (p || '').toLowerCase().includes(s))

	const byArea = useMemo(() => {
		if (!d) return []
		const filtered = d.screens.filter(
			(sc) => hit(sc.component, sc.label, sc.file) || sc.apiCalls.some((a) => hit(a.name)),
		)
		const m: Record<string, Screen[]> = {}
		for (const sc of filtered) (m[sc.area] = m[sc.area] || []).push(sc)
		return Object.entries(m).sort((a, b) => b[1].length - a[1].length)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [d, s])

	const endpoints = useMemo(() => {
		if (!d) return []
		return d.endpoints.filter((e) => hit(e.name) || e.screens.some((x) => hit(x.component, x.label)))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [d, s])

	if (!d) return <PageSkeleton kpis={3} rows={7} />
	if (d.error) return <div className="muted" style={{ padding: 16 }}>⚠ {d.error}</div>
	const c = d.counts

	const chips = (sc: Screen) => (
		<div className="api-chips">
			{sc.apiCalls.map((a) => (
				<span className="api-chip" key={a.name} style={{ color: '#56d364' }}>
					{a.name}
					<b>×{a.count}</b>
				</span>
			))}
			{Object.entries(sc.hooks).map(([h, n]) => (
				<span className="api-chip alt" key={h}>
					{h}
					<b>×{n}</b>
				</span>
			))}
		</div>
	)

	return (
		<>
			<div className="page-head">
				<h1>🔌 API ↔ 화면</h1>
				<span className="feat">
					코드의 API 호출을 <b>그걸 쓰는 화면(&lt;컴포넌트&gt; "라벨")</b>에 엮어 본다 · 🔴 = apiV2 레이어 우회
				</span>
			</div>

			<div className="kpis">
				<div className="kpi">
					<div className="v">{c.components}</div>
					<div className="l">API 쓰는 화면</div>
				</div>
				<div className="kpi">
					<div className="v">{c.endpoints}</div>
					<div className="l">엔드포인트</div>
				</div>
				<div className="kpi">
					<div className="v">{c.screens}</div>
					<div className="l">총 사용 파일</div>
				</div>
				<div className={`kpi ${c.raw > 0 ? 'warn' : ''}`}>
					<div className="v" style={{ color: c.raw ? FLAG_C.high : undefined }}>{c.raw}</div>
					<div className="l">🔴 레이어 우회</div>
				</div>
				<div className="kpi">
					<div className="v">{c.domains}</div>
					<div className="l">도메인</div>
				</div>
			</div>

			<div className="tabs2">
				<button className={tab === 'screens' ? 'on' : ''} onClick={() => setTab('screens')}>
					화면별 ({c.screens})
				</button>
				<button className={tab === 'endpoints' ? 'on' : ''} onClick={() => setTab('endpoints')}>
					엔드포인트별 ({c.endpoints})
				</button>
			</div>

			<input
				className="search"
				value={q}
				onChange={(e) => setQ(e.target.value)}
				placeholder="🔍 컴포넌트 · UI 라벨 · 엔드포인트(apiV2.x) · 파일 검색 (예: 예약, findBookings, Customer)"
			/>

			{tab === 'screens' &&
				byArea.map(([area, list]) => (
					<div className="area-group" key={area}>
						<h3 className="area-h">
							📂 {area} <span className="muted">· {list.length}화면</span>
						</h3>
						{list.map((sc) => {
							const id = sc.file
							const hasFlags = sc.flags.length > 0
							return (
								<div className="apiui-row" key={id}>
									<div
										className="apiui-head"
										onClick={() => hasFlags && setOpen(open === id ? null : id)}
										style={{ cursor: hasFlags ? 'pointer' : 'default' }}
									>
										{hasFlags ? <span className="caret">{open === id ? '▾' : '▸'}</span> : <span className="caret" />}
										<span className="lvl" style={{ background: KIND[sc.kind].c }}>{KIND[sc.kind].t}</span>
										<span className="gtm-ui">&lt;{sc.component}&gt;</span>
										{sc.label && <span className="gtm-label">"{sc.label}"</span>}
										{sc.raw && <span className="raw-badge" title="apiV2 레이어 우회/타입 무력화">🔴</span>}
										{chips(sc)}
										<code className="muted gtm-site">{sc.file.replace(/^src\//, '')}</code>
									</div>
									{hasFlags && open === id && (
										<div className="apiui-flags">
											{sc.flags.map((f, i) => (
												<div className="act-flag" key={i}>
													<span className="lvl" style={{ background: FLAG_C[f.level] }}>{f.level}</span>
													<span className="msg">{f.msg}</span>
												</div>
											))}
										</div>
									)}
								</div>
							)
						})}
					</div>
				))}
			{tab === 'screens' && !byArea.length && <p className="muted">검색 결과 없음.</p>}

			{tab === 'endpoints' &&
				endpoints.map((e) => (
					<div className="area-group" key={e.name}>
						<h3 className="area-h">
							🔌 {e.name} <span className="muted">· {e.count}화면에서 호출</span>
						</h3>
						{e.screens.map((x, i) => (
							<div className="flag-row" key={x.file + i}>
								<span className="gtm-ui">&lt;{x.component}&gt;</span>
								{x.label && <span className="gtm-label">"{x.label}"</span>}
								<code className="muted gtm-site">{x.file.replace(/^src\//, '')}</code>
							</div>
						))}
					</div>
				))}
			{tab === 'endpoints' && !endpoints.length && <p className="muted">검색 결과 없음.</p>}

			<div className="prompt-out" style={{ marginTop: 16 }}>
				<span className="muted" style={{ fontSize: 12 }}>
					API 레이어 = <code>@/libs/apiV2</code> · 🔴 우회는 개발중 페이지에서 파일별 상세 확인
				</span>
				<span className="fresh" style={{ marginLeft: 'auto' }}>빌드 {d.builtAt.replace('T', ' ').slice(0, 19)}</span>
			</div>
		</>
	)
}
