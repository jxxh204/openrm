import { useState } from 'react'

interface Ranked {
	agent: string
	session: string
	alive: boolean
	status: string
	note: string
	score: number
	reasons: string[]
}
interface RouteResult {
	recommended: string | null
	confidence: string
	ranked: Ranked[]
	error?: string
}
interface DispatchResult {
	ok: boolean
	sent?: boolean
	dryRun?: boolean
	error?: string
	preview?: { agent?: string; alive?: boolean; commands: string[]; messagePreview: string }
}

const CONF = { high: '#3fb950', mid: '#d29922', low: '#8b949e' } as Record<string, string>

export default function ControlPage() {
	const [task, setTask] = useState('')
	const [route, setRoute] = useState<RouteResult | null>(null)
	const [picked, setPicked] = useState('') // session
	const [result, setResult] = useState<DispatchResult | null>(null)
	const [busy, setBusy] = useState(false)

	const doRoute = () => {
		if (!task.trim()) return
		setBusy(true)
		setRoute(null)
		setResult(null)
		fetch('/api/route', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ task }),
		})
			.then((r) => r.json())
			.then((r: RouteResult) => {
				setRoute(r)
				const rec = r.ranked?.find((x) => x.agent === r.recommended) || r.ranked?.[0]
				setPicked(rec?.session || '')
			})
			.catch(() => {})
			.finally(() => setBusy(false))
	}

	const dispatch = (dryRun: boolean) => {
		if (!picked || !task.trim()) return
		const agent = route?.ranked.find((r) => r.session === picked)
		if (!dryRun && !confirm(`[${agent?.agent}] 에이전트에 전송할까요?\n\n"${task.slice(0, 120)}…"`)) return
		setBusy(true)
		fetch('/api/dispatch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ session: picked, message: task, dryRun }),
		})
			.then((r) => r.json())
			.then(setResult)
			.catch((e) => setResult({ ok: false, error: String(e) }))
			.finally(() => setBusy(false))
	}

	const pickedAgent = route?.ranked.find((r) => r.session === picked)

	return (
		<>
			<div className="page-head">
				<h1>📨 지시</h1>
				<span className="feat">업무를 적으면 적합한 에이전트로 자동 배치</span>
			</div>

			<div className="grid2">
				<div className="panel">
					<h3>1 · 업무 설명</h3>
					<textarea
						className="prompt"
						value={task}
						onChange={(e) => setTask(e.target.value)}
						rows={5}
						placeholder="예) 발송 플로우에서 야간 차단 버그 고쳐줘"
					/>
					<div className="actions">
						<button className="btn send" disabled={!task.trim() || busy} onClick={doRoute}>
							🎯 자동 배치
						</button>
					</div>

					{route && (
						<>
							<h3 style={{ marginTop: 18 }}>
								2 · 배치 추천{' '}
								{route.recommended && (
									<span className="conf" style={{ background: CONF[route.confidence] }}>
										{route.confidence}
									</span>
								)}
							</h3>
							{!route.recommended && (
								<p className="muted">매칭되는 에이전트를 못 찾음 — 아래에서 직접 선택.</p>
							)}
							<div className="rank">
								{route.ranked.map((r, i) => (
									<button
										key={r.agent}
										className={`rank-row ${r.session === picked ? 'on' : ''}`}
										onClick={() => setPicked(r.session)}
									>
										<span className="medal">{i === 0 ? '🥇' : i + 1}</span>
										<span className="ra">
											<b>{r.agent}</b>
											<span className="rn">{r.note || '—'}</span>
											<span className="rr">{r.reasons.join(' · ')}</span>
										</span>
										<span className="sc">{r.score}</span>
										<span className={`dot ${r.alive ? 'up' : 'down'}`} />
									</button>
								))}
							</div>
						</>
					)}
				</div>

				<div className="panel">
					<h3>3 · 전송</h3>
					{!picked && <p className="muted">자동 배치 후 대상이 정해지면 여기서 전송합니다.</p>}
					{pickedAgent && (
						<>
							<p style={{ fontSize: 13 }}>
								대상: <b>{pickedAgent.agent}</b>{' '}
								<span className={`dot ${pickedAgent.alive ? 'up' : 'down'}`} />{' '}
								<span className="muted">
									{pickedAgent.alive ? pickedAgent.session : '미기동 — 미리보기만'}
								</span>
							</p>
							<div className="actions">
								<button className="btn" disabled={busy} onClick={() => dispatch(true)}>
									미리보기
								</button>
								<button
									className="btn send"
									disabled={busy || !pickedAgent.alive}
									onClick={() => dispatch(false)}
								>
									▶ 전송
								</button>
							</div>
						</>
					)}

					{result?.error && (
						<div className="err" style={{ marginTop: 10 }}>
							⚠️ {result.error}
						</div>
					)}
					{result?.preview && (
						<div className="dispatch-result">
							<div className="badge-line">
								{result.sent ? (
									<span className="b ok">✅ 전송됨</span>
								) : (
									<span className="b dry">🔍 미리보기</span>
								)}
								<span className="b">{result.preview.agent}</span>
							</div>
							<h4>실행될 명령</h4>
							<pre className="cmd">{result.preview.commands.join('\n')}</pre>
							<h4>메시지</h4>
							<pre className="cmd msg">{result.preview.messagePreview}</pre>
						</div>
					)}
				</div>
			</div>

			<div className="callout-box">
				🎯 <b>자동 배치 기준</b> — 업무 키워드 ↔ 에이전트 전문영역(_note)·체인 일치 + 가용성(유휴·기동). 추천은
				바꿀 수 있고, 전송 전 확인·미리보기를 거칩니다.
			</div>
		</>
	)
}
