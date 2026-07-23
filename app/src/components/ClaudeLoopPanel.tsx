import { useEffect, useState } from 'react'
import XTerm from './XTerm'

// 🤖 Claude 모니터링 루프 패널 — 진짜 트리아지는 Claude가, OpenRM은 띄우고 상태만.
// kind로 ops(운영)/pr(PR) 등 여러 루프를 같은 UI로. MFA 인증 전엔 잠금.
interface ClaudeStatus {
	running: boolean
	kind?: string
	session: string
	loopSec?: number
	loopLabel?: string
	skill?: string
	working?: boolean
	needsAuth?: boolean
	waiting?: boolean
	tail?: string
}
const post = (url: string, body?: unknown) =>
	fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json())
// 초 → "30초" / "1분" / "15분"
const fmtSec = (s: number) => (s % 60 === 0 ? `${s / 60}분` : `${s}초`)

export default function ClaudeLoopPanel({
	kind,
	step,
	title,
	awsValid,
	defaultSec = 600,
	secs = [60, 300, 600],
}: {
	kind: string
	step: number
	title: string
	awsValid: boolean
	defaultSec?: number
	secs?: number[]
}) {
	const [cl, setCl] = useState<ClaudeStatus | null>(null)
	const [clOpen, setClOpen] = useState(true)
	const [clSec, setClSec] = useState(defaultSec)

	const load = () =>
		fetch(`/api/monitor/claude?kind=${kind}`)
			.then((r) => r.json())
			.then(setCl)
			.catch(() => {})
	useEffect(() => {
		load()
		const id = setInterval(load, 5000)
		return () => clearInterval(id)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [kind])
	const start = () => post('/api/monitor/claude/start', { kind, intervalSec: clSec }).then(() => setTimeout(load, 800))
	const stop = () => {
		if (!confirm(`${title} 루프를 정지합니다 (tmux 세션 종료).`)) return
		post('/api/monitor/claude/stop', { kind }).then(() => setTimeout(load, 500))
	}

	return (
		<div className={`claude-mon step ${cl?.running ? 'on' : ''} ${!cl?.running && !awsValid ? 'locked' : ''}`}>
			<div className="cm-head">
				<span className="step-num">{step}</span>
				<span className="cm-title">{title}</span>
				{cl?.running ? (
					<>
						<span className="cm-badge run">🟢 실행 중 · {cl.loopLabel || fmtSec(cl.loopSec || 600)} 루프</span>
						{cl.working && <span className="cm-badge work">⚙️ 작업 중</span>}
						{cl.waiting && !cl.working && <span className="cm-badge wait">⏸ 입력 대기</span>}
						{cl.needsAuth && <span className="cm-badge auth">⚠️ AWS 인증 필요 — 위 ① 에서 갱신</span>}
					</>
				) : cl == null ? (
					<span className="cm-badge off">확인 중…</span>
				) : awsValid ? (
					<span className="cm-badge off">⚪ 정지됨 — 시작 가능</span>
				) : (
					<span className="cm-badge lock">🔒 MFA 인증 후 시작 가능</span>
				)}
				<span className="cm-controls">
					{!cl?.running && (
						<select value={clSec} onChange={(e) => setClSec(Number(e.target.value))} className="sel" style={{ maxWidth: 88 }} disabled={!awsValid}>
							{secs.map((s) => (
								<option key={s} value={s}>
									{fmtSec(s)}
								</option>
							))}
						</select>
					)}
					{cl?.running ? (
						<>
							<button className="btn-dry" onClick={() => setClOpen((o) => !o)}>{clOpen ? '터미널 접기' : '터미널 열기'}</button>
							<button className="btn-dry" onClick={stop}>⏹ 정지</button>
						</>
					) : awsValid ? (
						<button className="btn-send" onClick={start}>▶ 시작</button>
					) : (
						<button className="btn-send locked" disabled title="먼저 ① AWS MFA 인증이 필요합니다">🔒 시작 (인증 필요)</button>
					)}
				</span>
			</div>
			{cl?.running && cl.tail && <div className="cm-tail">{cl.tail}</div>}
			{cl?.running && clOpen && (
				<div className="cm-term">
					<XTerm session={cl.session} />
				</div>
			)}
			{!cl?.running && (
				<p className="muted cm-hint">
					{awsValid ? (
						<>
							▶ 시작하면 대상 레포에서 <code>claude</code>를 띄우고 <code>/loop {clSec % 60 === 0 ? `${clSec / 60}m` : `${clSec}s`} {cl?.skill || ''}</code> 을 실행합니다. tmux라 OpenRM을 꺼도 루프는 계속 돕니다.
						</>
					) : (
						<>
							🔒 먼저 <b>① AWS MFA 인증</b>을 완료하세요. 인증되면 <code>▶ 시작</code> 이 활성화됩니다.
						</>
					)}
				</p>
			)}
		</div>
	)
}
