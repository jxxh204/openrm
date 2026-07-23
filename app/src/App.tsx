import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useModel } from './api'
import Layout from './components/Layout'
import ActivePage from './pages/ActivePage'
import MonitorPage from './pages/MonitorPage'
import AnalyzePage from './pages/AnalyzePage'
import ControlPage from './pages/ControlPage'
import ArchPage from './pages/ArchPage'
import TestsPage from './pages/TestsPage'
import ApiUiPage from './pages/ApiUiPage'
import FleetPage from './pages/FleetPage'
import PrsPage from './pages/PrsPage'
import SessionsPage from './pages/SessionsPage'
import WatchPage from './pages/WatchPage'
import ImprovePage from './pages/ImprovePage'
import TileLayout from './workspace/TileLayout'
import Toaster from './components/Toaster'
import ResourceBar from './components/ResourceBar'
import JobBar from './components/JobBar'
import DesktopOnly from './components/DesktopOnly'
import { useIsMobile } from './hooks/useIsMobile'

type Mode = 'sidebar' | 'split'

export default function App() {
	const { model, conn } = useModel()
	const isMobile = useIsMobile()
	const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('mrm-mode') as Mode) || 'sidebar')
	const changeMode = (m: Mode) => {
		setMode(m)
		localStorage.setItem('mrm-mode', m)
	}
	// 폰: 분할(타일) 모드는 드래그 기반이라 터치에서 못 씀 → 저장값 무시하고 sidebar 강제.
	const effectiveMode: Mode = isMobile ? 'sidebar' : mode

	return (
		<>
			{/* 모니터 특이사항 토스트 — 모드 무관 항상 활성 */}
			<Toaster />
			{/* 전역 리소스 바 — 최상단 공통, 맥북 부하 가늠 */}
			<ResourceBar />
			{/* 전역 진행바 — claude 잡(일감·백로그) 추적, 페이지 이동에도 유지 */}
			<JobBar />
			{effectiveMode === 'split' ? (
				<TileLayout onExit={() => changeMode('sidebar')} />
			) : (
				<Routes>
					<Route element={<Layout model={model} conn={conn} onSplit={isMobile ? undefined : () => changeMode('split')} isMobile={isMobile} />}>
						<Route index element={<MonitorPage model={model} />} />
						<Route path="active" element={<ActivePage />} />
						<Route path="analyze" element={<AnalyzePage />} />
						<Route path="control" element={<ControlPage />} />
						{/* 데스크톱 전용(폰 게이팅): 그래프·개발실 */}
						<Route path="graph" element={isMobile ? <DesktopOnly title="아키텍처" icon="🗂️" reason="의존성 그래프(확대·이동)와 스토리북 미리보기는 넓은 화면과 정밀 포인터가 필요해요." /> : <ArchPage />} />
						<Route path="tests" element={<TestsPage />} />
						<Route path="apimap" element={<ApiUiPage />} />
						<Route path="fleet" element={<FleetPage />} />
						<Route path="prs" element={<PrsPage />} />
						<Route path="sessions" element={isMobile ? <DesktopOnly title="개발실" icon="🧑‍💻" reason="여러 AI 에이전트 터미널이 동시에 뜨는 콕핏이라 키보드 입력이 필요해요." /> : <SessionsPage />} />
						<Route path="watch" element={<WatchPage />} />
						<Route path="improve" element={<ImprovePage />} />
						<Route path="*" element={<Navigate to="/" replace />} />
					</Route>
				</Routes>
			)}
		</>
	)
}
