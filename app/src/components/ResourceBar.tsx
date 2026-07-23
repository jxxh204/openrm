import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

// 전역 리소스 바 — 켜진 Claude/터미널/dev서버 수를 최상단에 항상 표시 (맥북 과부하 방지용).
interface Res {
	agents: number
	claude: number
	devServers: number
	loops: { ops: boolean; pr: boolean }
}

export default function ResourceBar() {
	const [r, setR] = useState<Res | null>(null)
	const path = useLocation().pathname
	const onSessions = path === '/sessions' // 개발실은 자체 헤더가 있어 전역 바 숨김(중복·겹침 방지)
	useEffect(() => {
		const f = () =>
			fetch('/api/resources')
				.then((x) => x.json())
				.then(setR)
				.catch(() => {})
		const t = setTimeout(f, 500) // 첫 호출 지연 — 보드(/api/tasks)가 단일 스레드 백엔드를 먼저 쓰게
		const id = setInterval(f, 15000)
		return () => {
			clearTimeout(t)
			clearInterval(id)
		}
	}, [])
	if (!r || onSessions) return null
	const heavy = r.claude >= 6 || r.devServers >= 5 || r.agents >= 8
	const loops = (r.loops.ops ? 1 : 0) + (r.loops.pr ? 1 : 0)
	return (
		<div className={`resbar ${heavy ? 'heavy' : ''}`} title="실행 중 리소스 — 맥북 부하 가늠 (Claude 에이전트·터미널·dev서버)">
			<span className="resb-item" title="실행 중 Claude 에이전트(모니터링 루프 포함)">
				🤖 Claude <b>{r.claude}</b>
			</span>
			<span className="resb-item" title="떠있는 dev 서버">
				🖥️ dev <b>{r.devServers}</b>
			</span>
			<span className="resb-item" title="OpenRM이 띄운 터미널/tmux 세션 총수">
				📺 터미널 <b>{r.agents}</b>
			</span>
			{loops > 0 && (
				<span className="resb-item dim" title="운영/PR 모니터링 루프">
					🔁 루프 <b>{loops}</b>
				</span>
			)}
			{heavy && <span className="resb-warn">⚠️ 부하 높음</span>}
		</div>
	)
}
