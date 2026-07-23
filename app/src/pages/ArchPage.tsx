import { useEffect, useRef, useState } from 'react'
import FileTree from '../components/FileTree'
import type { TreeNode } from '../components/FileTree'
import DepGraph from '../components/DepGraph'

// Storybook URL (기본 6006). 안 떠 있으면 이미지 탭이 빈 화면일 수 있음.
const SB = 'http://localhost:6006'

interface ApiFlag {
	level: 'high' | 'mid' | 'low'
	file: string
	msg: string
}
interface FolderDetail {
	folder: string
	files: string[]
	tests: string[]
	stories: { file: string; slug: string | null }[]
	api: {
		counts: { files: number; apiFiles: number; apiFns: number; flags: number }
		apiList: { name: string; count: number }[]
		hooks: Record<string, number>
		flags: ApiFlag[]
	}
	error?: string
}

type Tab = 'image' | 'tests' | 'api' | 'dep'
const FLAG_COLOR = { high: '#f85149', mid: '#d29922', low: '#8b949e' }

interface FigmaNode {
	node: string
	backlog: string
	title: string | null
}

const clampZoom = (z: number) => Math.min(5, Math.max(0.2, Math.round(z * 100) / 100))

function ZoomBar({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
	return (
		<div className="zoombar">
			<button onClick={() => setZoom(clampZoom(zoom - 0.25))} title="축소">
				−
			</button>
			<input
				type="range"
				min={0.2}
				max={5}
				step={0.05}
				value={zoom}
				onChange={(e) => setZoom(Number(e.target.value))}
			/>
			<button onClick={() => setZoom(clampZoom(zoom + 0.25))} title="확대">
				+
			</button>
			<button className="zb-reset" onClick={() => setZoom(1)} title="100%로">
				{Math.round(zoom * 100)}%
			</button>
		</div>
	)
}

// Figma 노드(좌) ↔ Storybook 렌더(우) 비교. 줌 + 전체화면. figmaNodes는 피처 전체에서 선택.
function CompareView({ stories, sb }: { stories: { file: string; slug: string | null }[]; sb: string }) {
	const [list, setList] = useState<FigmaNode[] | null>(null)
	const [fnode, setFnode] = useState<string | null>(null)
	const [imgs, setImgs] = useState<Record<string, string | null>>({}) // 노드ID → 이미지 URL (배치 1회 prefetch)
	const [links, setLinks] = useState<Record<string, string>>({})
	const [figmaReason, setFigmaReason] = useState<string | null>(null)
	const [floading, setFloading] = useState(false)
	const [storyIdx, setStoryIdx] = useState(0)
	const [zoom, setZoom] = useState(1)
	const [full, setFull] = useState(false)
	const latestRef = useRef<string | null>(null)
	const story = stories[storyIdx] ?? stories[0]

	// 노드별 지연 로드 — 로컬 Dev Mode MCP가 노드당 받아오므로 선택 시 1건씩. 받은 건 imgs에 캐시.
	const pickNode = (n: string, force = false) => {
		setFnode(n)
		if (!force && imgs[n] !== undefined) return
		latestRef.current = n
		setFloading(true)
		setFigmaReason(null)
		fetch(`/api/figma?nodes=${encodeURIComponent(n)}`)
			.then((r) => r.json())
			.then((d) => {
				if (latestRef.current !== n) return
				setImgs((prev) => ({ ...prev, [n]: d.images?.[n] ?? null }))
				setLinks((prev) => ({ ...prev, ...(d.links || {}) }))
				setFigmaReason(d.ok ? null : d.reason || null)
			})
			.catch(() => latestRef.current === n && setFigmaReason('fetch 실패'))
			.finally(() => latestRef.current === n && setFloading(false))
	}
	useEffect(() => {
		fetch('/api/figma/nodes')
			.then((r) => r.json())
			.then((d) => {
				const ns: FigmaNode[] = d.nodes || []
				setList(ns)
				if (ns[0]) pickNode(ns[0].node)
			})
			.catch(() => setList([]))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const curUrl = fnode ? imgs[fnode] : undefined
	const curLink = fnode ? links[fnode] : undefined

	useEffect(() => {
		if (!full) return
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false)
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [full])

	const grid = (
		<div className="compare-grid">
			<div className="compare-col">
				<div className="compare-col-head">
					<span className="cc-title">
						🎨 Figma
						<button className="fig-refresh" onClick={() => fnode && pickNode(fnode, true)} title="이 노드 다시 받기">
							↻
						</button>
					</span>
					<div className="figma-chips">
						{list?.map((n) => (
							<button
								key={n.node}
								className={`fchip ${fnode === n.node ? 'on' : ''}`}
								onClick={() => pickNode(n.node)}
								title={n.title ? `${n.backlog} · ${n.title}` : n.backlog}
							>
								{n.node}
							</button>
						))}
					</div>
				</div>
				<div className="zoom-wrap">
					{floading ? (
						<p className="muted z-msg">불러오는 중…</p>
					) : curUrl ? (
						<div className="zoom-inner" style={{ zoom }}>
							<img src={curUrl} alt={fnode || 'figma'} />
						</div>
					) : (
						<div className="figma-fallback z-msg">
							{figmaReason === 'rate-limit' ? (
								<p className="muted">
									⚠ Figma 플랜 한도(View seat/low) — 미리 받아둔 노드만 표시됩니다. 나머지는 딥링크로 확인하세요
								</p>
							) : figmaReason === 'no-token' ? (
								<p className="muted">FIGMA_TOKEN 설정 시 디자인이 렌더됩니다.</p>
							) : figmaReason ? (
								<p className="muted">⚠ {figmaReason}</p>
							) : (
								<p className="muted">이 파일키에 없는 노드일 수 있어요 (다른 Figma 파일).</p>
							)}
							{curLink && (
								<a className="figma-open" href={curLink} target="_blank" rel="noreferrer">
									Figma에서 열기 ↗
								</a>
							)}
						</div>
					)}
				</div>
			</div>
			<div className="compare-col">
				<div className="compare-col-head">
					<span className="cc-title">🖥️ 현재 (Storybook)</span>
					{stories.length > 0 && (
						<div className="story-tabs">
							{stories.map((s, i) => (
								<button key={s.file} className={i === storyIdx ? 'on' : ''} onClick={() => setStoryIdx(i)}>
									{s.file.replace(/\.stories\.tsx?$/, '')}
								</button>
							))}
						</div>
					)}
				</div>
				<div className="zoom-wrap">
					{stories.length === 0 ? (
						<p className="muted z-msg">이 폴더에 *.stories.tsx 없음 — UI 미리보기 불가.</p>
					) : story?.slug ? (
						<div className="zoom-inner" style={{ zoom }}>
							<iframe className="sb-frame-z" title="storybook" src={`${sb}/?path=/story/${story.slug}`} />
						</div>
					) : (
						<p className="muted z-msg">스토리 slug 파싱 실패 — Storybook에서 직접 확인.</p>
					)}
				</div>
			</div>
		</div>
	)

	return (
		<>
			<div className="compare-toolbar">
				<ZoomBar zoom={zoom} setZoom={setZoom} />
				<button className="cmp-full" onClick={() => setFull(true)} title="전체화면 비교">
					⛶ 크게 비교
				</button>
			</div>
			{!full && grid}
			{full && (
				<div className="compare-modal">
					<div className="compare-modal-bar">
						<span className="cm-title">Figma ↔ 현재 화면</span>
						<ZoomBar zoom={zoom} setZoom={setZoom} />
						<button className="cm-close" onClick={() => setFull(false)} title="닫기 (Esc)">
							✕ 닫기
						</button>
					</div>
					<div className="compare-modal-body">{grid}</div>
				</div>
			)}
		</>
	)
}

export default function ArchPage() {
	const [tree, setTree] = useState<TreeNode | null>(null)
	const [sel, setSel] = useState('domains/manual-message')
	const [detail, setDetail] = useState<FolderDetail | null>(null)
	const [tab, setTab] = useState<Tab>('api')

	useEffect(() => {
		fetch('/api/tree')
			.then((r) => r.json())
			.then(setTree)
			.catch(() => {})
	}, [])
	useEffect(() => {
		if (!sel) return
		setDetail(null)
		fetch(`/api/folder?path=${encodeURIComponent(sel)}`)
			.then((r) => r.json())
			.then(setDetail)
			.catch(() => {})
	}, [sel])

	const api = detail?.api

	return (
		<>
			<div className="page-head">
				<h1>🗂️ 아키텍처</h1>
				<span className="feat">VSCode식 폴더 · 클릭 → 이미지 · 테스트 · API</span>
			</div>

			<div className="arch">
				{/* 좌: 파일 트리 */}
				<div className="arch-tree">
					<FileTree tree={tree} selected={sel} onSelect={setSel} />
				</div>

				{/* 우: 폴더 상세 */}
				<div className="arch-detail">
					<div className="detail-head">
						<code>src/{sel}</code>
						{detail && (
							<span className="muted" style={{ fontSize: 12 }}>
								파일 {detail.files.length} · 테스트 {detail.tests.length} · 스토리{' '}
								{detail.stories.length} · API {api?.counts.apiFns}종
								{!!api?.counts.flags && <span className="flag"> · ⚠️ 오용 {api.counts.flags}</span>}
							</span>
						)}
					</div>

					<div className="tabs2">
						{(['api', 'image', 'tests', 'dep'] as Tab[]).map((t) => (
							<button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
								{t === 'api'
									? `API${api?.counts.flags ? ` ⚠️${api.counts.flags}` : ''}`
									: t === 'image'
									? `이미지${detail ? ` (${detail.stories.length})` : ''}`
									: t === 'tests'
									? `테스트${detail ? ` (${detail.tests.length})` : ''}`
									: '의존관계'}
							</button>
						))}
					</div>

					{!detail && (
						<div className="muted" style={{ padding: 16 }}>
							불러오는 중…
						</div>
					)}
					{detail?.error && <div className="err">⚠️ {detail.error}</div>}

					{detail && tab === 'api' && api && (
						<div className="tabpane">
							<h4>사용 중인 API 엔드포인트 ({api.apiList.length})</h4>
							{api.apiList.length ? (
								<div className="api-chips">
									{api.apiList.map((a) => (
										<span className="api-chip" key={a.name}>
											{a.name}
											<b>×{a.count}</b>
										</span>
									))}
								</div>
							) : (
								<p className="muted">이 폴더에서 직접 호출하는 apiV2 엔드포인트 없음.</p>
							)}

							<h4 style={{ marginTop: 16 }}>react-query 훅</h4>
							<div className="api-chips">
								{Object.entries(api.hooks)
									.filter(([, v]) => v > 0)
									.map(([k, v]) => (
										<span className="api-chip alt" key={k}>
											{k}
											<b>×{v}</b>
										</span>
									))}
								{Object.values(api.hooks).every((v) => v === 0) && <span className="muted">없음</span>}
							</div>

							<h4 style={{ marginTop: 16 }}>🚩 오용 의심 ({api.flags.length})</h4>
							{api.flags.length ? (
								api.flags.map((f, i) => (
									<div className="flag-row" key={i}>
										<span className="lvl" style={{ background: FLAG_COLOR[f.level] }}>
											{f.level}
										</span>
										<code>{f.file.replace(sel + '/', '')}</code>
										<span className="msg">{f.msg}</span>
									</div>
								))
							) : (
								<p className="muted">감지된 오용 없음 ✅</p>
							)}
						</div>
					)}

					{detail && tab === 'image' && (
						<div className="tabpane">
							<CompareView key={sel} stories={detail.stories} sb={SB} />
							<p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
								왼쪽 = 백로그 figmaNodes · 오른쪽 = Storybook 렌더({SB}). ⛶ 크게 비교 = 전체화면 · 줌으로 디테일 대조.
							</p>
						</div>
					)}

					{detail && tab === 'tests' && (
						<div className="tabpane">
							{detail.tests.length ? (
								<>
									<h4>테스트 파일 ({detail.tests.length})</h4>
									{detail.tests.map((t) => (
										<div className="flag-row" key={t}>
											<span className="lvl" style={{ background: '#3fb950' }}>
												test
											</span>
											<code>{t}</code>
										</div>
									))}
									<div className="prompt-out">
										<span className="muted" style={{ fontSize: 12 }}>
											이 폴더만 테스트:
										</span>
										<pre className="cmd">yarn test src/{sel}</pre>
										<button
											className="btn"
											onClick={() => navigator.clipboard?.writeText(`yarn test src/${sel}`)}
										>
											복사
										</button>
									</div>
								</>
							) : (
								<p className="muted">이 폴더에 테스트 파일 없음.</p>
							)}
						</div>
					)}

					{detail && tab === 'dep' && (
						<div className="tabpane">
							<DepGraph scope={sel} />
						</div>
					)}
				</div>
			</div>
		</>
	)
}
