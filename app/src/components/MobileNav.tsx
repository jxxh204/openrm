import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PAGES } from '../workspace/pages'

// 폰 하단 탭바 — 핵심 모니터 4개 고정 + '더보기' 시트(나머지 전체).
// 라벨/아이콘은 사이드바와 동일 단일 소스(PAGES) 재사용.
const NAV_BY_TO: Record<string, (typeof PAGES)[number]> = Object.fromEntries(PAGES.map((p) => [p.to, p]))
const PRIMARY = ['/', '/watch', '/prs', '/fleet'] // 하단 고정 탭(감시·모니터·내PR·플릿)
const MORE_GROUPS: { label: string; tos: string[] }[] = [
	{ label: '핵심 작업', tos: ['/sessions', '/active'] },
	{ label: '분석 · 참조', tos: ['/analyze', '/control', '/graph', '/tests', '/apimap'] },
	{ label: 'OpenRM', tos: ['/improve'] },
]

export default function MobileNav() {
	const [moreOpen, setMoreOpen] = useState(false)
	return (
		<>
			{moreOpen && (
				<div className="msheet-backdrop" onClick={() => setMoreOpen(false)}>
					<div className="msheet" onClick={(e) => e.stopPropagation()}>
						<div className="msheet-head">
							<span>전체 메뉴</span>
							<button className="msheet-x" onClick={() => setMoreOpen(false)} aria-label="닫기">
								✕
							</button>
						</div>
						{MORE_GROUPS.map((g) => (
							<div className="msheet-group" key={g.label}>
								<div className="msheet-label">{g.label}</div>
								<div className="msheet-items">
									{g.tos.map((to) => {
										const n = NAV_BY_TO[to]
										if (!n) return null
										return (
											<NavLink key={to} to={to} end={n.end} className={({ isActive }) => 'msheet-item' + (isActive ? ' active' : '')} onClick={() => setMoreOpen(false)}>
												<span className="ico">{n.icon}</span>
												<span className="nm">{n.label}</span>
												{n.badge && <span className="tag">{n.badge}</span>}
											</NavLink>
										)
									})}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
			<nav className="mtabbar">
				{PRIMARY.map((to) => {
					const n = NAV_BY_TO[to]
					if (!n) return null
					return (
						<NavLink key={to} to={to} end={n.end} className={({ isActive }) => 'mtab' + (isActive ? ' active' : '')}>
							<span className="mtab-ico">{n.icon}</span>
							<span className="mtab-nm">{n.label}</span>
						</NavLink>
					)
				})}
				<button className={'mtab' + (moreOpen ? ' active' : '')} onClick={() => setMoreOpen(true)}>
					<span className="mtab-ico">⋯</span>
					<span className="mtab-nm">더보기</span>
				</button>
			</nav>
		</>
	)
}
