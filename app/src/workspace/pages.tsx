import { useModel } from '../api'
import MonitorPage from '../pages/MonitorPage'
import SessionsPage from '../pages/SessionsPage'
import WatchPage from '../pages/WatchPage'
import ActivePage from '../pages/ActivePage'
import AnalyzePage from '../pages/AnalyzePage'
import ControlPage from '../pages/ControlPage'
import ArchPage from '../pages/ArchPage'
import TestsPage from '../pages/TestsPage'
import ApiUiPage from '../pages/ApiUiPage'
import FleetPage from '../pages/FleetPage'
import PrsPage from '../pages/PrsPage'
import ImprovePage from '../pages/ImprovePage'

// 감시는 model이 필요 → 타일 안에서 자체 구독하는 래퍼
function MonitorTile() {
	const { model } = useModel()
	return <MonitorPage model={model} />
}

// 사이드바 메뉴 + 분할모드 태그의 **단일 소스(변수트리)**. 라벨/아이콘/순서/배지/라우트 한 곳에서 관리.
export interface PageDef {
	id: string // 분할모드 타일 키 (저장 호환 위해 유지)
	to: string // 사이드바 라우트 경로
	end?: boolean // 라우트 exact 매칭
	icon: string
	label: string
	badge?: string
	render: () => JSX.Element
}

export const PAGES: PageDef[] = [
	{ id: 'active', to: '/active', icon: '🛠️', label: '개발중', badge: '★', render: () => <ActivePage /> },
	{ id: 'cockpit', to: '/sessions', icon: '🧑‍💻', label: '개발실', badge: 'DEV', render: () => <SessionsPage /> },
	{ id: 'fleet', to: '/fleet', icon: '🚀', label: '플릿', badge: 'WT', render: () => <FleetPage /> },
	{ id: 'prs', to: '/prs', icon: '🔀', label: '내 PR', badge: 'PR', render: () => <PrsPage /> },
	{ id: 'watch', to: '/watch', icon: '🔔', label: '모니터', badge: 'NEW', render: () => <WatchPage /> },
	{ id: 'monitor', to: '/', end: true, icon: '📋', label: '감시', badge: 'W0', render: () => <MonitorTile /> },
	{ id: 'analyze', to: '/analyze', icon: '📊', label: '조사', badge: 'W1', render: () => <AnalyzePage /> },
	{ id: 'control', to: '/control', icon: '📨', label: '지시', badge: 'W2', render: () => <ControlPage /> },
	{ id: 'graph', to: '/graph', icon: '🗂️', label: '아키텍처', badge: 'W3', render: () => <ArchPage /> },
	{ id: 'tests', to: '/tests', icon: '✅', label: '테스트', badge: 'W5', render: () => <TestsPage /> },
	{ id: 'apimap', to: '/apimap', icon: '🔌', label: 'API', badge: '화면', render: () => <ApiUiPage /> },
	{ id: 'improve', to: '/improve', icon: '🛠️', label: 'OpenRM 개선', badge: 'SELF', render: () => <ImprovePage /> },
]

export const PAGE_BY_ID: Record<string, PageDef> = Object.fromEntries(PAGES.map((p) => [p.id, p]))
