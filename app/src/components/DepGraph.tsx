import { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import type { Core, ElementDefinition } from 'cytoscape'

interface GNode {
	id: string
	kind: string
	files: number
	deg: number
}
interface Graph {
	counts: { nodes: number; edges: number; files: number }
	nodes: GNode[]
	edges: { from: string; to: string; weight: number }[]
	error?: string
}

const KIND_COLOR: Record<string, string> = {
	folder: '#58a6ff',
	component: '#3fb950',
	hook: '#d29922',
	api: '#58a6ff',
	atom: '#a855f7',
	page: '#f0883e',
	util: '#8b949e',
}

// 폴더 scope의 import 의존 그래프 + reorg 드래그(W4). ArchPage 의존관계 탭에서 사용.
export default function DepGraph({ scope }: { scope: string }) {
	const boxRef = useRef<HTMLDivElement>(null)
	const cyRef = useRef<Core | null>(null)
	const [mode, setMode] = useState<'folder' | 'file'>('file')
	const [graph, setGraph] = useState<Graph | null>(null)
	const [loading, setLoading] = useState(false)
	const [reorg, setReorg] = useState<{ from: string; to: string; impact?: number; common?: boolean }[]>([])
	const [prompt, setPrompt] = useState<{
		prompt?: string
		totalImpact?: number
		commonHit?: number
		error?: string
	} | null>(null)
	const addMoveRef = useRef<(from: string, to: string) => void>(() => {})

	addMoveRef.current = (from, to) => {
		if (from === to || reorg.some((m) => m.from === from)) return
		const common = /(^|\/)common(\/|$)/.test(from) || /(^|\/)common(\/|$)/.test(to)
		setReorg((r) => [...r, { from, to, common }])
		fetch(`/api/reorg/impact?from=${encodeURIComponent(from)}`)
			.then((r) => r.json())
			.then((im) => setReorg((r) => r.map((m) => (m.from === from ? { ...m, impact: im.importerCount } : m))))
			.catch(() => {})
	}

	const throwToAI = () => {
		setPrompt(null)
		fetch('/api/reorg/prompt', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ plan: reorg }),
		})
			.then((r) => r.json())
			.then(setPrompt)
			.catch((e) => setPrompt({ error: String(e) }))
	}

	useEffect(() => {
		setLoading(true)
		setReorg([])
		setPrompt(null)
		fetch(`/api/graph?scope=${encodeURIComponent(scope)}&mode=${mode}&depth=5`)
			.then((r) => r.json())
			.then(setGraph)
			.catch(() => {})
			.finally(() => setLoading(false))
	}, [scope, mode])

	useEffect(() => {
		if (!graph || graph.error || !boxRef.current) return
		const maxDeg = Math.max(...graph.nodes.map((n) => n.deg), 1)
		const elements: ElementDefinition[] = [
			...graph.nodes.map((n) => ({
				data: {
					id: n.id,
					label: n.id.split('/').pop() || n.id,
					kind: n.kind,
					size: 12 + (n.deg / maxDeg) * 34,
				},
			})),
			...graph.edges.map((e) => ({ data: { id: `${e.from}->${e.to}`, source: e.from, target: e.to } })),
		]
		cyRef.current?.destroy()
		const cy = cytoscape({
			container: boxRef.current,
			elements,
			style: [
				{
					selector: 'node',
					style: {
						'background-color': (n) => KIND_COLOR[n.data('kind')] || '#8b949e',
						width: 'data(size)',
						height: 'data(size)',
						label: 'data(label)',
						color: '#c9d4e0',
						'font-size': 7,
						'text-valign': 'bottom',
						'min-zoomed-font-size': 7,
					},
				},
				{
					selector: 'edge',
					style: { width: 1, 'line-color': '#30363d', 'curve-style': 'haystack', opacity: 0.5 },
				},
				{ selector: 'node.dim', style: { opacity: 0.12 } },
				{ selector: 'edge.dim', style: { opacity: 0.04 } },
				{ selector: 'node.hi', style: { 'border-width': 2, 'border-color': '#fff' } },
				{ selector: 'edge.hi', style: { 'line-color': '#58a6ff', opacity: 0.9, width: 2 } },
			],
			layout: {
				name: 'cose',
				animate: false,
				nodeRepulsion: 5000,
				idealEdgeLength: 55,
				padding: 16,
			} as cytoscape.LayoutOptions,
		})
		cyRef.current = cy

		cy.on('tap', 'node', (evt) => {
			const node = evt.target
			cy.elements().addClass('dim')
			node.closedNeighborhood().removeClass('dim').addClass('hi')
		})
		cy.on('tap', (evt) => {
			if (evt.target === cy) cy.elements().removeClass('dim hi')
		})
		cy.on('grab', 'node', (e) => e.target.scratch('_p0', { ...e.target.position() }))
		cy.on('dragfree', 'node', (evt) => {
			const node = evt.target
			const p = node.position()
			const hit = cy.nodes().filter((o) => {
				if (o.id() === node.id()) return false
				const bb = o.boundingBox()
				return p.x >= bb.x1 && p.x <= bb.x2 && p.y >= bb.y1 && p.y <= bb.y2
			})
			if (hit.length) {
				addMoveRef.current(node.id(), hit[0].id())
				const p0 = node.scratch('_p0')
				if (p0) node.position(p0)
			}
		})
		return () => cy.destroy()
	}, [graph])

	return (
		<div>
			<div className="graph-legend">
				{['component', 'hook', 'api', 'atom', 'page', 'util'].map((k) => (
					<span key={k}>
						<i style={{ background: KIND_COLOR[k] }} />
						{k}
					</span>
				))}
				<span className="toolbar" style={{ gap: 4 }}>
					<button className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}>
						파일
					</button>
					<button className={mode === 'folder' ? 'on' : ''} onClick={() => setMode('folder')}>
						폴더
					</button>
				</span>
				{graph && (
					<span className="gcount">
						노드 {graph.counts.nodes} · 간선 {graph.counts.edges}
						{loading && ' · 로딩…'}
					</span>
				)}
			</div>

			<div className="graph-wrap" style={{ height: '46vh' }}>
				<div ref={boxRef} className="graph-box" />
			</div>

			<div className="reorg" style={{ marginTop: 10 }}>
				<div className="reorg-head">
					<b>📦 재배치 플랜</b>
					<span className="muted" style={{ fontSize: 12 }}>
						노드를 다른 노드 위로 드래그 = 이동(플랜만)
					</span>
					{reorg.length > 0 && (
						<button
							className="btn"
							style={{ marginLeft: 'auto' }}
							onClick={() => {
								setReorg([])
								setPrompt(null)
							}}
						>
							비우기
						</button>
					)}
				</div>
				{reorg.length === 0 ? (
					<p className="muted" style={{ fontSize: 12 }}>
						그래프에서 노드를 끌어 다른 노드 위에 놓으면 재배치 플랜이 됩니다.
					</p>
				) : (
					<>
						{reorg.map((m, i) => (
							<div className={`move ${m.common ? 'common' : ''}`} key={i}>
								<code>src/{m.from}</code>
								<span className="arr">→</span>
								<code>src/{m.to}</code>
								<span className="imp">{m.impact == null ? '계산중…' : `import ${m.impact}개`}</span>
								{m.common && <span className="flag">🚫 common</span>}
								<button className="x" onClick={() => setReorg((r) => r.filter((_, j) => j !== i))}>
									✕
								</button>
							</div>
						))}
						<div className="actions" style={{ marginTop: 8 }}>
							<button className="btn send" onClick={throwToAI}>
								🤖 AI에 던지기
							</button>
						</div>
					</>
				)}
				{prompt?.prompt && (
					<div className="prompt-out">
						<div className="badge-line" style={{ marginBottom: 8 }}>
							<span className="b">이동 {reorg.length}건</span>
							<span className="b">영향 {prompt.totalImpact}개</span>
							{!!prompt.commonHit && <span className="b dry">⚠️ common {prompt.commonHit}</span>}
							<button
								className="btn"
								style={{ marginLeft: 'auto', padding: '3px 10px' }}
								onClick={() => navigator.clipboard?.writeText(prompt.prompt || '')}
							>
								복사
							</button>
						</div>
						<pre className="cmd msg">{prompt.prompt}</pre>
					</div>
				)}
			</div>
		</div>
	)
}
