import { NavLink } from 'react-router-dom'

// 폰에서 다루기 어려운 데스크톱 전용 화면(개발실 터미널·디버깅 iframe·아키텍처 그래프) 대신
// 안내 + 대체 행동(모니터링 페이지)을 보여준다.
export default function DesktopOnly({ title, icon, reason }: { title: string; icon?: string; reason?: string }) {
	return (
		<div className="desktop-only">
			<div className="do-emoji">🖥️</div>
			<h2 className="do-title">
				{icon ? icon + ' ' : ''}
				{title} — 데스크톱 전용
			</h2>
			<p className="do-reason">{reason || '이 화면은 터미널·드래그·넓은 패널이 필요해 폰에서는 다루기 어려워요. 맥에서 열어주세요.'}</p>
			<div className="do-alts">
				<div className="do-alts-label">폰에서는 이런 걸 볼 수 있어요</div>
				<NavLink to="/" end className="do-alt">
					📋 감시 · 에이전트/백로그 현황
				</NavLink>
				<NavLink to="/watch" className="do-alt">
					🔔 모니터 · 장애/CI/이슈 피드
				</NavLink>
				<NavLink to="/prs" className="do-alt">
					🔀 내 PR · PR 상태
				</NavLink>
				<NavLink to="/fleet" className="do-alt">
					🚀 플릿 · 워크트리 현황
				</NavLink>
			</div>
		</div>
	)
}
