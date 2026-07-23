import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { Model } from '../types'
import { PAGES } from '../workspace/pages'
import DeployWidget from './DeployWidget'
import MobileNav from './MobileNav'
import QuoteOfWeek from './QuoteOfWeek'

// 사이드바 메뉴는 분할모드 태그와 동일한 단일 소스(workspace/pages.tsx PAGES)를 사용.
// 리디자인: 제품 taxonomy를 반영한 3그룹으로 묶는다.
const NAV_BY_TO: Record<string, (typeof PAGES)[number]> = Object.fromEntries(PAGES.map((p) => [p.to, p]))
const NAV_GROUPS: { label: string; tos: string[] }[] = [
	{ label: '핵심 작업', tos: ['/sessions', '/active', '/fleet', '/prs'] },
	{ label: '모니터링', tos: ['/watch', '/'] },
	{ label: '분석 · 참조', tos: ['/analyze', '/control', '/graph', '/tests', '/apimap'] },
	{ label: 'OpenRM', tos: ['/improve'] },
]

// 데스크톱 사이드바 하단: 같은 Wi-Fi 폰에서 접속할 주소 안내(탭해서 복사). 기존 /api/localip 재사용.
function PhoneAccess() {
	const [ip, setIp] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	useEffect(() => {
		fetch('/api/localip')
			.then((r) => r.json())
			.then((d: { ip?: string | null }) => setIp(d.ip || null))
			.catch(() => {})
	}, [])
	if (!ip) return null
	const url = `http://${ip}:5180`
	return (
		<button
			className="phone-access"
			title="같은 Wi-Fi의 폰 브라우저에 입력 (탭해서 복사)"
			onClick={() => {
				navigator.clipboard?.writeText(url)
				setCopied(true)
				setTimeout(() => setCopied(false), 1500)
			}}
		>
			<span className="pa-ico">📱</span>
			<span className="pa-url">{copied ? '복사됨!' : url}</span>
		</button>
	)
}

function ConnStatus({ conn }: { conn: string }) {
	return (
		<>
			<span className={`conn ${conn === 'live' ? 'live' : conn === 'reconnecting' ? 'reconn' : ''}`} />
			<span className="foot-status">{conn === 'live' ? '실시간' : conn === 'reconnecting' ? '재연결…' : '연결중'}</span>
			<span className="foot-src">SSE</span>
		</>
	)
}

export default function Layout({ conn, onSplit, isMobile }: { model?: Model | null; conn: string; onSplit?: () => void; isMobile?: boolean }) {
	// 폰: 사이드바 대신 상단 앱바 + 하단 탭바. 콘텐츠는 동일 <Outlet/>.
	if (isMobile) {
		return (
			<div className="shell mobile">
				<header className="m-appbar">
					<span className="brand-dot" />
					<span className="logo">OpenRM</span>
					<span className="m-appbar-grow" />
					<ConnStatus conn={conn} />
				</header>
				<QuoteOfWeek variant="strip" />
				<main className="content">
					<Outlet />
				</main>
				<MobileNav />
			</div>
		)
	}
	return (
		<div className="shell">
			<aside className="sidebar">
				<div className="brand">
					<span className="brand-dot" />
					<span className="logo">OpenRM</span>
					<span className="sub">병렬 개발 콕핏</span>
					{onSplit && (
						<button className="split-btn" onClick={onSplit} title="화면 분할(작업공간) 모드로 전환">
							▦
						</button>
					)}
				</div>

				<QuoteOfWeek />

				<nav className="nav">
					{NAV_GROUPS.map((grp) => (
						<div className="nav-group" key={grp.label}>
							<div className="nav-group-label">{grp.label}</div>
							{grp.tos.map((to) => {
								const n = NAV_BY_TO[to]
								if (!n) return null
								return (
									<NavLink key={to} to={to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
										<span className="ico">{n.icon}</span>
										<span className="nm">{n.label}</span>
										<span className="tag">{n.badge}</span>
									</NavLink>
								)
							})}
						</div>
					))}
				</nav>

				<div className="sb-deploy">
					<DeployWidget />
				</div>

				<PhoneAccess />

				<div className="foot">
					<ConnStatus conn={conn} />
				</div>
			</aside>

			<main className="content">
				<Outlet />
			</main>
		</div>
	)
}
