import type { CSSProperties } from 'react'

// 스켈레톤 로딩 UI — 실제 레이아웃(헤더·KPI·행/카드)을 미러링해 깜빡임·레이아웃 시프트 없이 자연스럽게.
export function Skel({ w = '100%', h = 14, r = 8, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
	return <div className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} />
}

// 직전에 그려졌던 업무 보드 형태(그룹·카드 수)를 기억 → 스켈레톤을 같은 개수로 그려 CLS 최소화.
const HUES = [212, 152, 28, 340, 265, 48, 190, 100]
type Shape = { named: boolean; count: number }[]
function loadShape(): Shape {
	try {
		const s = JSON.parse(localStorage.getItem('mrm-board-shape') || '')
		if (Array.isArray(s) && s.length) return s.slice(0, 12)
	} catch {
		/* noop */
	}
	// 없으면 그럴듯한 기본 형태(그룹 3 × 카드 3)
	return [
		{ named: true, count: 3 },
		{ named: true, count: 2 },
		{ named: true, count: 3 },
	]
}

// 접힌 카드 헤드 한 줄(그립·티켓·제목 + 우측 액션 클러스터) — 실제 .task-card.collapsed와 동일 박스모델
function SkelCard({ seed }: { seed: number }) {
	return (
		<div className="task-card collapsed">
			<div className="task-head">
				<Skel w={10} h={14} r={3} />
				<Skel w={80} h={16} r={5} />
				<Skel w={`${38 + (seed % 42)}%`} h={14} />
				<span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
					<Skel w={22} h={22} r={6} />
					<Skel w={40} h={22} r={7} />
					<Skel w={44} h={22} r={7} />
					<Skel w={92} h={22} r={6} />
					<Skel w={50} h={22} r={7} />
					<Skel w={20} h={22} r={6} />
				</span>
			</div>
		</div>
	)
}

// 실제 .task-groups 구조를 그대로 미러 (그룹 헤더 + 카드 목록)
function BoardSkeleton() {
	const shape = loadShape()
	return (
		<div className="task-groups" aria-busy="true" aria-label="불러오는 중">
			<div className="task-groups-bar">
				<Skel w={54} h={22} r={6} />
				<Skel w={230} h={12} />
			</div>
			{shape.map((grp, gi) => (
				<div key={gi} className={`task-group ${grp.named ? 'named' : 'none'}`} style={grp.named ? ({ '--g-accent': `hsl(${HUES[gi % HUES.length]} 62% 52%)` } as CSSProperties) : undefined}>
					<div className="task-group-head">
						<span className="tg-caret">▾</span>
						<span className="tg-folder">{grp.named ? '📁' : '📥'}</span>
						<Skel w={72} h={14} />
						<Skel w={20} h={16} r={999} />
						{grp.named && (
							<span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
								<Skel w={40} h={20} r={6} />
								<Skel w={64} h={20} r={6} />
								<Skel w={72} h={20} r={6} />
								<Skel w={20} h={20} r={6} />
							</span>
						)}
					</div>
					<div className="task-board">
						{Array.from({ length: Math.max(1, grp.count) }).map((_, ci) => (
							<SkelCard key={ci} seed={gi * 7 + ci * 13} />
						))}
					</div>
				</div>
			))}
		</div>
	)
}

export default function PageSkeleton({ kpis = 5, rows = 6, cards = false, head = true, board = false }: { kpis?: number; rows?: number; cards?: boolean; head?: boolean; board?: boolean }) {
	if (board) return <BoardSkeleton />
	return (
		<div className="skel-wrap" aria-busy="true" aria-label="불러오는 중">
			{head && (
				<div className="skel-head">
					<Skel w={150} h={24} r={7} />
					<Skel w={240} h={13} />
				</div>
			)}
			{kpis > 0 && (
				<div className="skel-kpis">
					{Array.from({ length: kpis }).map((_, i) => (
						<div key={i} className="skel-kpi">
							<Skel w={54} h={28} r={6} />
							<Skel w={76} h={11} />
						</div>
					))}
				</div>
			)}
			{cards ? (
				<div className="skel-cards">
					{Array.from({ length: rows }).map((_, i) => (
						<div key={i} className="skel-card">
							<div className="skel-card-top">
								<Skel w={9} h={9} r={9} />
								<Skel w={110} h={15} />
								<Skel w={42} h={18} r={999} style={{ marginLeft: 'auto' }} />
							</div>
							<Skel w="88%" h={12} />
							<Skel w="64%" h={12} />
						</div>
					))}
				</div>
			) : (
				<div className="skel-rows">
					{Array.from({ length: rows }).map((_, i) => (
						<div key={i} className="skel-row">
							<Skel w={96} h={14} r={6} />
							<Skel w={`${34 + ((i * 13) % 42)}%`} h={13} />
							<Skel w={70} h={18} r={6} style={{ marginLeft: 'auto' }} />
						</div>
					))}
				</div>
			)}
		</div>
	)
}
