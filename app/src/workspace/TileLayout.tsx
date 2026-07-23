import { useRef, useState } from 'react'
import { PAGE_BY_ID, PAGES } from './pages'

// ── 타일 트리 (이진 분할) ──
type Node =
	| { kind: 'leaf'; id: string; page: string }
	| { kind: 'split'; id: string; dir: 'row' | 'col'; sizes: [number, number]; a: Node; b: Node }

type Zone = 'left' | 'right' | 'top' | 'bottom' | 'center'
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : 'n' + Math.floor(performance.now() * 1000))

// 순수 트리 연산
function replace(root: Node, id: string, fn: (n: Node) => Node): Node {
	if (root.id === id) return fn(root)
	if (root.kind === 'split') return { ...root, a: replace(root.a, id, fn), b: replace(root.b, id, fn) }
	return root
}
function removeLeaf(root: Node | null, id: string): Node | null {
	if (!root) return null
	if (root.kind === 'leaf') return root.id === id ? null : root
	const a = removeLeaf(root.a, id)
	const b = removeLeaf(root.b, id)
	if (!a) return b // 한쪽 사라지면 다른 쪽으로 붕괴
	if (!b) return a
	return { ...root, a, b }
}
function splitLeaf(root: Node, leafId: string, zone: Zone, page: string): Node {
	if (zone === 'center') return replace(root, leafId, (n) => ({ ...(n as any), kind: 'leaf', page }))
	const dir: 'row' | 'col' = zone === 'left' || zone === 'right' ? 'row' : 'col'
	const before = zone === 'left' || zone === 'top'
	return replace(root, leafId, (leaf) => {
		const fresh: Node = { kind: 'leaf', id: uid(), page }
		return { kind: 'split', id: uid(), dir, sizes: [0.5, 0.5], a: before ? fresh : leaf, b: before ? leaf : fresh }
	})
}

function zoneFromPointer(rect: DOMRect, x: number, y: number): Zone {
	const px = (x - rect.left) / rect.width
	const py = (y - rect.top) / rect.height
	const edge = 0.28
	const dl = px,
		dr = 1 - px,
		dt = py,
		db = 1 - py
	const m = Math.min(dl, dr, dt, db)
	if (m > edge) return 'center'
	if (m === dl) return 'left'
	if (m === dr) return 'right'
	if (m === dt) return 'top'
	return 'bottom'
}

export default function TileLayout({ onExit }: { onExit?: () => void }) {
	const [root, setRoot] = useState<Node | null>(null)
	const [hint, setHint] = useState<{ leafId: string; zone: Zone } | null>(null)
	const dragPage = useRef<string | null>(null)

	const onChipDragStart = (e: React.DragEvent, pageId: string) => {
		dragPage.current = pageId
		e.dataTransfer.setData('application/mrm-page', pageId)
		e.dataTransfer.effectAllowed = 'copy'
	}
	const getPage = (e: React.DragEvent) => e.dataTransfer.getData('application/mrm-page') || dragPage.current || ''

	// 빈 캔버스에 첫 드롭
	const onEmptyDrop = (e: React.DragEvent) => {
		e.preventDefault()
		const page = getPage(e)
		if (page) setRoot({ kind: 'leaf', id: uid(), page })
		setHint(null)
	}

	const onLeafDragOver = (e: React.DragEvent, leafId: string, el: HTMLElement) => {
		e.preventDefault()
		e.dataTransfer.dropEffect = 'copy'
		const zone = zoneFromPointer(el.getBoundingClientRect(), e.clientX, e.clientY)
		setHint((h) => (h && h.leafId === leafId && h.zone === zone ? h : { leafId, zone }))
	}
	const onLeafDrop = (e: React.DragEvent, leafId: string, el: HTMLElement) => {
		e.preventDefault()
		const page = getPage(e)
		if (page && root) {
			const zone = zoneFromPointer(el.getBoundingClientRect(), e.clientX, e.clientY)
			setRoot(splitLeaf(root, leafId, zone, page))
		}
		setHint(null)
		dragPage.current = null
	}

	const close = (leafId: string) => setRoot((r) => removeLeaf(r, leafId))
	const swapPage = (leafId: string, page: string) => setRoot((r) => (r ? replace(r, leafId, (n) => ({ ...(n as any), kind: 'leaf', page })) : r))

	return (
		<div className="ws-root">
			<TopChips onDragStart={onChipDragStart} onDragEnd={() => (dragPage.current = null)} onExit={onExit} />
			<div className="ws-canvas">
				{root ? (
					<RenderNode node={root} setRoot={setRoot} hint={hint} onLeafDragOver={onLeafDragOver} onLeafDrop={onLeafDrop} onClose={close} onSwap={swapPage} />
				) : (
					<div className="ws-empty" onDragOver={(e) => e.preventDefault()} onDrop={onEmptyDrop}>
						<div className="big">🧩</div>
						<h3>화면 분할 작업공간</h3>
						<p>위 칩을 이 영역으로 끌어다 놓으면 페이지가 열립니다. 가장자리에 놓으면 그 방향으로 분할됩니다.</p>
					</div>
				)}
			</div>
		</div>
	)
}

function TopChips({ onDragStart, onDragEnd, onExit }: { onDragStart: (e: React.DragEvent, id: string) => void; onDragEnd: () => void; onExit?: () => void }) {
	return (
		<div className="ws-chips">
			<span className="ws-brand">MRM</span>
			<button className="ws-mode-btn" onClick={onExit} title="사이드바 모드로 전환">
				≡ 사이드바
			</button>
			<span className="ws-sep" />
			{PAGES.map((p) => (
				<div key={p.id} className="ws-chip" draggable onDragStart={(e) => onDragStart(e, p.id)} onDragEnd={onDragEnd} title={`${p.label} — 캔버스로 드래그`}>
					<span className="ico">{p.icon}</span>
					{p.label}
				</div>
			))}
		</div>
	)
}

function RenderNode(props: {
	node: Node
	setRoot: React.Dispatch<React.SetStateAction<Node | null>>
	hint: { leafId: string; zone: Zone } | null
	onLeafDragOver: (e: React.DragEvent, id: string, el: HTMLElement) => void
	onLeafDrop: (e: React.DragEvent, id: string, el: HTMLElement) => void
	onClose: (id: string) => void
	onSwap: (id: string, page: string) => void
}): JSX.Element {
	const { node } = props
	if (node.kind === 'leaf') {
		const def = PAGE_BY_ID[node.page]
		const showHint = props.hint && props.hint.leafId === node.id
		return (
			<div
				className="tile"
				onDragOver={(e) => props.onLeafDragOver(e, node.id, e.currentTarget)}
				onDrop={(e) => props.onLeafDrop(e, node.id, e.currentTarget)}
			>
				<div className="tile-head">
					<span className="tile-title">
						{def?.icon} {def?.label || node.page}
					</span>
					<select
						className="tile-swap"
						value={node.page}
						onChange={(e) => props.onSwap(node.id, e.target.value)}
						title="이 타일의 페이지 바꾸기"
					>
						{PAGES.map((p) => (
							<option key={p.id} value={p.id}>
								{p.icon} {p.label}
							</option>
						))}
					</select>
					<button className="tile-x" onClick={() => props.onClose(node.id)} title="타일 닫기">
						✕
					</button>
				</div>
				<div className="tile-body">{def ? def.render() : <p className="muted">알 수 없는 페이지</p>}</div>
				{showHint && <div className={`drop-hint ${props.hint!.zone}`} />}
			</div>
		)
	}
	// split
	const setSizes = (sizes: [number, number]) => props.setRoot((r) => (r ? replace(r, node.id, (n) => ({ ...(n as any), sizes })) : r))
	return (
		<div className={`split ${node.dir}`}>
			<div className="split-pane" style={{ flexGrow: node.sizes[0], flexBasis: 0 }}>
				<RenderNode {...props} node={node.a} />
			</div>
			<Divider dir={node.dir} onResize={setSizes} />
			<div className="split-pane" style={{ flexGrow: node.sizes[1], flexBasis: 0 }}>
				<RenderNode {...props} node={node.b} />
			</div>
		</div>
	)
}

function Divider({ dir, onResize }: { dir: 'row' | 'col'; onResize: (s: [number, number]) => void }) {
	const onDown = (e: React.PointerEvent) => {
		e.preventDefault()
		const el = (e.currentTarget.parentElement as HTMLElement) || document.body
		const rect = el.getBoundingClientRect()
		const total = dir === 'row' ? rect.width : rect.height
		const start = dir === 'row' ? rect.left : rect.top
		const move = (ev: PointerEvent) => {
			const pos = (dir === 'row' ? ev.clientX : ev.clientY) - start
			let f = pos / total
			f = Math.max(0.12, Math.min(0.88, f))
			onResize([f, 1 - f])
		}
		const up = () => {
			window.removeEventListener('pointermove', move)
			window.removeEventListener('pointerup', up)
			document.body.style.cursor = ''
		}
		window.addEventListener('pointermove', move)
		window.addEventListener('pointerup', up)
		document.body.style.cursor = dir === 'row' ? 'col-resize' : 'row-resize'
	}
	return <div className={`divider ${dir}`} onPointerDown={onDown} />
}
