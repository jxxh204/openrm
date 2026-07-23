import { useEffect, useState } from 'react'
import { ago } from '../api'
import ClaudeLoopPanel from '../components/ClaudeLoopPanel'

// 🔔 모니터 — PR 리뷰·CI·이슈 특이사항을 추적·관리하는 보드 (cmux "10분 모니터링" 대체).
interface Finding {
	key: string
	kind: 'ci' | 'review' | 'issue'
	status: 'open' | 'resolved' | 'regression'
	title: string
	detail?: string
	url?: string | null
	repo: string
	ticket?: string | null
	firstSeen: number
	lastSeen: number
	resolvedAt?: number | null
	recurred?: boolean
	pr?: { number: number; repo: string; state: string; url: string; draft: boolean } | null
	questioning?: boolean
	question?: { question: string; answer: string; agreesWithObjection: boolean; at: number } | null
}
interface Ev {
	id: number
	ts: number
	level: string
	title: string
	detail?: string
	url?: string | null
}
interface State {
	running: boolean
	intervalMs: number
	lastPoll: number
	lastError: string | null
	counts: { unresolved: number; regression: number; withPr: number; resolved: number }
	findings: Finding[]
	events: Ev[]
}

const KIND_ICON: Record<string, string> = { ci: '❌', review: '🔴', issue: '🐛' }
const STATE_C: Record<string, string> = { OPEN: '#2e9e50', MERGED: '#7c5cd6', CLOSED: '#8b94a0' }
const post = (url: string, body?: unknown) =>
	fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	}).then((r) => r.json())

interface AwsStatus {
	valid: boolean
	error?: string | null
	account?: string
	arn?: string
	serial?: string | null
	hasSerial?: boolean
	expiration?: string | null
	remainingMs?: number | null
	renewedAt?: number | null
}
interface Alert {
	id: string
	title: string
	ts: string
	threadUrl: string | null
	resolved: boolean
	summary: string
	symptom?: string | null
	impact?: string | null
	source?: string | null
	status?: string | null
	count?: number
	acked: boolean
	converted: boolean
	taskKey?: string | null
}
interface AlertsState {
	fetchedAt: number
	fetching: boolean
	intervalMs: number
	counts: { unresolved: number; total: number }
	alerts: Alert[]
}
const fmtRemain = (ms?: number | null) => {
	if (ms == null) return null
	if (ms <= 0) return '만료됨'
	const h = Math.floor(ms / 3600000)
	const m = Math.floor((ms % 3600000) / 60000)
	return h > 0 ? `${h}시간 ${m}분 남음` : `${m}분 남음`
}

export default function WatchPage() {
	const [st, setSt] = useState<State | null>(null)
	const [busy, setBusy] = useState(false)
	const [aws, setAws] = useState<AwsStatus | null>(null)
	const [mfa, setMfa] = useState('')
	const [mfaBusy, setMfaBusy] = useState(false)
	const [mfaMsg, setMfaMsg] = useState<{ ok: boolean; text: string } | null>(null)
	const [alerts, setAlerts] = useState<AlertsState | null>(null)
	const [alFetching, setAlFetching] = useState(false)
	const [convBusy, setConvBusy] = useState<string | null>(null)
	// Sentry 직접 감시
	type SentryStatus = {
		configured: boolean
		org: string
		project: string
		identifier: string
		kind: string
		tokenMasked: string
		query: string
	}
	type SentryIssue = {
		shortId: string
		title: string
		level?: string
		count: number
		userCount: number
		lastSeen?: string
		status?: string
		url: string
		project?: string
	}
	type SentryProbe = {
		ok: boolean
		identifier: string
		org: string
		kind: string
		detail: unknown
		projects: { id: string; slug: string; name: string }[]
		error?: string
	}
	const [sentry, setSentry] = useState<SentryStatus | null>(null)
	const [sToken, setSToken] = useState('')
	const [sId, setSId] = useState('')
	const [sProbe, setSProbe] = useState<SentryProbe | null>(null)
	const [sIssues, setSIssues] = useState<SentryIssue[]>([])
	const [sBusy, setSBusy] = useState(false)
	const [sMsg, setSMsg] = useState<string | null>(null)

	const load = () =>
		fetch('/api/monitor')
			.then((r) => r.json())
			.then(setSt)
			.catch(() => {})
	const loadAlerts = () =>
		fetch('/api/monitor/alerts')
			.then((r) => r.json())
			.then(setAlerts)
			.catch(() => {})
	const runFetchAlerts = () => {
		setAlFetching(true)
		post('/api/monitor/alerts/fetch')
			.then(() => loadAlerts())
			.finally(() => setAlFetching(false))
	}
	const ackAlert = (id: string) => post('/api/monitor/alerts/ack', { id }).then(loadAlerts)
	const convertAlert = (a: Alert) => {
		if (!a.threadUrl) {
			alert('이 알림은 스레드 링크가 없어 업무로 전환할 수 없어요.')
			return
		}
		setConvBusy(a.id)
		post('/api/tasks/enrich', { url: a.threadUrl })
			.then((r: { ok?: boolean; key?: string; error?: string }) => {
				if (r.ok) post('/api/monitor/alerts/converted', { id: a.id, taskKey: r.key }).then(loadAlerts)
				else alert('업무 전환 실패: ' + (r.error || '?'))
			})
			.finally(() => setConvBusy(null))
	}
	const setAlInterval = (ms: number) => post('/api/monitor/alerts/interval', { intervalMs: ms }).then(loadAlerts)
	const loadAws = (force?: boolean) =>
		fetch('/api/monitor/aws' + (force ? '?force=1' : ''))
			.then((r) => r.json())
			.then(setAws)
			.catch(() => {})
	const loadSentry = () =>
		fetch('/api/sentry/status')
			.then((r) => r.json())
			.then((d: SentryStatus) => {
				setSentry(d)
				setSId((v) => v || d.identifier || '')
			})
			.catch(() => {})
	const loadSentryIssues = () =>
		fetch('/api/sentry/issues?period=24h&limit=30')
			.then((r) => r.json())
			.then((d: { ok: boolean; issues: SentryIssue[]; error?: string }) => {
				setSIssues(d.issues || [])
				if (d.error) setSMsg('에러 조회 실패: ' + d.error)
			})
			.catch(() => {})
	const saveSentry = async (patch: Record<string, string>) => {
		setSBusy(true)
		try {
			const d = await post('/api/sentry/config', patch)
			setSentry(d as SentryStatus)
			return d as SentryStatus
		} finally {
			setSBusy(false)
		}
	}
	const probeSentry = async () => {
		const id = sId.trim()
		if (!id) {
			setSMsg('식별자(예: PROD-CRM-WEB-SERVER-25N)를 입력하세요.')
			return
		}
		setSBusy(true)
		setSMsg(null)
		setSProbe(null)
		try {
			const d: SentryProbe = await fetch('/api/sentry/probe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ identifier: id }),
			}).then((r) => r.json())
			setSProbe(d)
			if (d.ok !== false && d.kind && d.kind !== 'unknown') {
				const patch: Record<string, string> = { sentryIdentifier: id, sentryKind: d.kind }
				if (d.kind === 'project' && d.detail && typeof d.detail === 'object')
					patch.sentryProject = (d.detail as { slug: string }).slug
				await saveSentry(patch)
				loadSentry()
				loadSentryIssues()
			} else if (d.ok === false) setSMsg(d.error || '조사 실패')
		} catch (e) {
			setSMsg('조사 오류: ' + String(e))
		} finally {
			setSBusy(false)
		}
	}
	useEffect(() => {
		load()
		loadAws()
		loadAlerts()
		loadSentry()
		loadSentryIssues()
		const id = setInterval(load, 10000)
		const id3 = setInterval(() => loadAws(), 20000)
		const id4 = setInterval(loadAlerts, 12000)
		const id5 = setInterval(loadSentryIssues, 60000)
		return () => {
			clearInterval(id)
			clearInterval(id3)
			clearInterval(id4)
			clearInterval(id5)
		}
	}, [])
	const renewMfa = () => {
		const code = mfa.trim()
		if (!/^\d{6}$/.test(code)) {
			setMfaMsg({ ok: false, text: '6자리 숫자를 입력하세요.' })
			return
		}
		setMfaBusy(true)
		setMfaMsg(null)
		post('/api/monitor/aws/mfa', { code })
			.then((d: { ok?: boolean; error?: string }) => {
				if (d.ok) {
					setMfaMsg({ ok: true, text: '✅ AWS MFA 세션 갱신 완료' })
					setMfa('')
					loadAws(true)
				} else {
					setMfaMsg({ ok: false, text: '⚠️ ' + (d.error || '갱신 실패') })
				}
			})
			.catch((e) => setMfaMsg({ ok: false, text: '⚠️ ' + String(e) }))
			.finally(() => setMfaBusy(false))
	}

	const act = (fn: Promise<unknown>) => {
		setBusy(true)
		fn.then((s) => setSt(s as State)).finally(() => {
			setBusy(false)
			load()
		})
	}

	// 🗣️ 실제 GitHub 리뷰(변경요청 등)에 이의/질문 — mrm 대시보드 안에서만 답변 표시(GitHub엔 게시 X)
	const [questionModal, setQuestionModal] = useState<{ key: string; title: string } | null>(null)
	const [questionText, setQuestionText] = useState('')
	const [answerModal, setAnswerModal] = useState<{
		title: string
		question: NonNullable<Finding['question']>
	} | null>(null)
	const askFinding = () => {
		if (!questionModal || !questionText.trim()) return
		post('/api/monitor/question', { key: questionModal.key, question: questionText.trim() })
			.then((d: { ok?: boolean; error?: string }) => {
				if (!d.ok) {
					alert('리뷰 항의 실패: ' + (d.error || '?'))
					return
				}
				setQuestionModal(null)
				setQuestionText('')
				load()
			})
			.catch((e) => alert('리뷰 항의 실패: ' + String(e)))
	}

	if (!st)
		return (
			<div className="muted" style={{ padding: 16 }}>
				모니터 상태 불러오는 중…
			</div>
		)
	const c = st.counts
	const unresolved = st.findings.filter((f) => f.status === 'open' || f.status === 'regression')
	const regressions = unresolved.filter((f) => f.status === 'regression')
	const opens = unresolved.filter((f) => f.status === 'open')
	const resolved = st.findings.filter((f) => f.status === 'resolved').slice(0, 12)

	const row = (f: Finding) => (
		<div key={f.key} className={`find-row ${f.status}`}>
			<span className="find-ico">{f.recurred ? '🔁' : KIND_ICON[f.kind]}</span>
			{f.ticket && <code className="find-ticket">{f.ticket}</code>}
			<a className="find-title" href={f.url || undefined} target="_blank" rel="noreferrer">
				{f.title.replace(/^(CI 실패|변경요청|이슈) /, '')}{' '}
				{f.detail && <span className="muted">— {f.detail}</span>}
			</a>
			{f.pr ? (
				<a
					className="ck-chip pr"
					href={f.pr.url}
					target="_blank"
					rel="noreferrer"
					style={{ color: STATE_C[f.pr.state] || 'var(--muted)' }}
					title="연결된 PR"
				>
					🔀#{f.pr.number} {f.pr.draft ? 'draft' : f.pr.state}
				</a>
			) : f.kind === 'issue' ? (
				<span className="ck-chip none">PR 없음</span>
			) : null}
			{f.kind === 'review' &&
				(f.question ? (
					<button
						className="ck-chip ghost"
						onClick={() => setAnswerModal({ title: f.detail || f.title, question: f.question! })}
						title="답변 보기"
					>
						🗣️ 답변{f.question.agreesWithObjection ? ' · 인정' : ''}
					</button>
				) : (
					<button
						className="ck-chip ghost"
						disabled={!!f.questioning}
						onClick={() => setQuestionModal({ key: f.key, title: f.detail || f.title })}
						title="리뷰 판정에 이의 제기 / 질문"
					>
						{f.questioning ? '🗣️ 확인 중…' : '🗣️ 항의'}
					</button>
				))}
			<span className="find-repo">{f.repo}</span>
			<span className="find-ago">{ago(f.lastSeen)}</span>
		</div>
	)

	return (
		<>
			<div className="page-head">
				<h1>🔔 모니터</h1>
				<span className="feat">
					<b>Claude 운영 모니터링 루프</b> + GitHub PR·이슈 특이사항(코드) 보조
				</span>
				<div className="toolbar">
					<span className={`mon-dot ${st.running ? 'on' : ''}`} title={st.running ? '감시 중' : '정지'} />
					<button
						className={st.running ? 'on' : ''}
						onClick={() => act(post('/api/monitor/config', { running: !st.running }))}
						disabled={busy}
					>
						{st.running ? '⏸ 정지' : '▶ 시작'}
					</button>
					<select
						value={st.intervalMs}
						onChange={(e) => act(post('/api/monitor/config', { intervalMs: Number(e.target.value) }))}
						className="sel"
						style={{ maxWidth: 110 }}
					>
						<option value={60000}>1분</option>
						<option value={180000}>3분</option>
						<option value={600000}>10분</option>
					</select>
					<button onClick={() => act(post('/api/monitor/poll'))} disabled={busy} title="지금 폴링">
						↻
					</button>
					<button onClick={() => post('/api/monitor/test')} title="토스트 테스트">
						🔔
					</button>
				</div>
			</div>

			{/* ① 🔐 AWS MFA 세션 — 모니터링의 전제조건. 인증돼야 ② 모니터링 시작이 열린다 */}
			<div className={`aws-mfa step ${aws ? (aws.valid ? 'ok' : 'expired') : ''}`}>
				<div className="am-head">
					<span className="step-num">1</span>
					<span className="am-title">🔐 AWS MFA 인증</span>
					{aws == null ? (
						<span className="cm-badge off">확인 중…</span>
					) : aws.valid ? (
						<>
							<span className="cm-badge run">🟢 인증됨</span>
							{aws.remainingMs != null && <span className="am-remain">{fmtRemain(aws.remainingMs)}</span>}
							{aws.arn && (
								<span className="am-arn" title={aws.arn}>
									{aws.arn.split('/').pop()}
								</span>
							)}
						</>
					) : (
						<span className="cm-badge auth">⚠️ {aws.error || '세션 만료 — 인증 필요'}</span>
					)}
					<span className="am-controls">
						<input
							className="am-input"
							inputMode="numeric"
							autoComplete="one-time-code"
							pattern="\d*"
							maxLength={6}
							placeholder="MFA 6자리"
							value={mfa}
							onChange={(e) => setMfa(e.target.value.replace(/\D/g, '').slice(0, 6))}
							onKeyDown={(e) => {
								if (e.key === 'Enter') renewMfa()
							}}
							disabled={mfaBusy}
						/>
						<button className="btn-send" onClick={renewMfa} disabled={mfaBusy || mfa.length !== 6}>
							{mfaBusy ? '인증 중…' : aws?.valid ? '🔄 갱신' : '🔓 인증'}
						</button>
						<button
							className="btn-dry"
							title="상태 새로고침"
							onClick={() => loadAws(true)}
							disabled={mfaBusy}
						>
							↻
						</button>
					</span>
				</div>
				{mfaMsg && <div className={`am-msg ${mfaMsg.ok ? 'ok' : 'err'}`}>{mfaMsg.text}</div>}
				{aws && !aws.hasSerial && (
					<div className="am-msg err">⚠️ ~/.aws/config 의 [default]에 mfa_serial이 없습니다.</div>
				)}
				{aws?.valid ? (
					<p className="am-hint am-ready">✓ 인증 완료 — 아래 ②·③ 에서 모니터링 루프를 시작할 수 있어요.</p>
				) : (
					<p className="muted am-hint">
						Authenticator 6자리를 넣고 인증하면 <code>aws sts get-session-token</code> 으로 <code>mfa</code>{' '}
						프로필 토큰을 자동 기록합니다. <b>인증돼야 모니터링을 시작할 수 있어요.</b>
					</p>
				)}
			</div>

			{/* ② 운영 장애 모니터링 루프 · ③ PR 점검 모니터링 루프 — MFA 인증 전엔 잠김 */}
			{/* 🚨 Sentry 직접 감시 — Slack/스레드 경유 없이 Sentry API를 직접 폴링 */}
			<div className={`sentry-mon step ${sentry?.configured ? 'ok' : ''}`}>
				<div className="sm-head">
					<span className="sm-title">🚨 Sentry 직접 감시</span>
					{sentry == null ? (
						<span className="cm-badge off">확인 중…</span>
					) : sentry.configured ? (
						<span className="cm-badge run">
							🟢 연결됨 · {sentry.org}
							{sentry.kind ? ' · ' + sentry.kind : ''}
						</span>
					) : (
						<span className="cm-badge auth">⚠️ 토큰 미설정</span>
					)}
					{sentry?.configured && (
						<button className="btn-dry" onClick={loadSentryIssues} disabled={sBusy} title="지금 조회">
							↻
						</button>
					)}
				</div>
				<div className="sm-config">
					<input
						className="am-input"
						style={{ width: 210 }}
						type="password"
						placeholder={
							sentry?.tokenMasked ? `설정됨 (${sentry.tokenMasked})` : 'Sentry Auth Token 붙여넣기'
						}
						value={sToken}
						onChange={(e) => setSToken(e.target.value)}
					/>
					<button
						className="btn-send"
						disabled={sBusy || !sToken.trim()}
						onClick={async () => {
							await saveSentry({ sentryToken: sToken.trim() })
							setSToken('')
							loadSentry()
							loadSentryIssues()
						}}
					>
						토큰 저장
					</button>
					<input
						className="am-input"
						style={{ width: 250 }}
						placeholder="감시 대상 (예: PROD-CRM-WEB-SERVER-25N)"
						value={sId}
						onChange={(e) => setSId(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') probeSentry()
						}}
					/>
					<button
						className="btn-send"
						disabled={sBusy || !sentry?.configured}
						onClick={probeSentry}
						title="이 식별자가 프로젝트/서버태그/이슈 중 무엇인지 자동 조사"
					>
						{sBusy ? '조사 중…' : '🔎 조사'}
					</button>
				</div>
				{sMsg && <div className="am-msg err">{sMsg}</div>}
				{sProbe && sProbe.ok !== false && (
					<div className="sm-probe">
						{sProbe.kind === 'project' && (
							<>
								📁 <b>프로젝트</b>로 확인 — 이 프로젝트의 미해결 이슈를 감시합니다.
							</>
						)}
						{sProbe.kind === 'server_name' && (
							<>
								🖥️ <b>서버 태그</b>로 확인 — <code>server_name</code> 필터로 감시합니다.
							</>
						)}
						{sProbe.kind === 'issue' && (
							<>
								🐛 <b>단일 이슈</b>로 확인 — 이 이슈를 추적합니다.
							</>
						)}
						{sProbe.kind === 'unknown' && (
							<>
								❓ 매칭 실패 (프로젝트 {sProbe.projects.length}개) — 프로젝트 slug를 직접 넣거나 쿼리를
								조정하세요.
							</>
						)}
					</div>
				)}
				{sentry?.configured ? (
					<div className="sm-issues">
						<div className="sm-issues-head">
							최근 24h 미해결 <b>{sIssues.length}</b>
							{sentry.identifier ? ` · 대상: ${sentry.identifier}` : ''}
						</div>
						{sIssues.length ? (
							sIssues.map((it) => (
								<a
									key={it.shortId}
									className={`sm-issue lvl-${it.level || 'error'}`}
									href={it.url}
									target="_blank"
									rel="noreferrer"
								>
									<span className="sm-i-id">{it.shortId}</span>
									<span className="sm-i-title">{it.title}</span>
									<span className="sm-i-meta">
										{it.count}회{it.userCount ? ` · ${it.userCount}명` : ''}
									</span>
								</a>
							))
						) : (
							<p className="muted" style={{ fontSize: 12 }}>
								미해결 에러 없음 (또는 감시 대상 미설정)
							</p>
						)}
					</div>
				) : (
					<p className="muted am-hint">
						Sentry → Settings → <b>Auth Tokens</b> 에서 발급(스코프: <code>project:read</code> ·{' '}
						<code>event:read</code> · <code>org:read</code>) → 위에 붙여넣기. org는 <code>SENTRY_ORG</code> 환경변수로{' '}
						설정. 감시되면 미해결 에러가 위 <b>특이사항</b>·토스트로도 뜹니다.
					</p>
				)}
			</div>

			<ClaudeLoopPanel
				kind="ops"
				step={2}
				title="🤖 운영 장애 모니터링 루프"
				awsValid={!!aws?.valid}
				defaultSec={600}
				secs={[60, 300, 600, 1800]}
			/>
			<ClaudeLoopPanel
				kind="pr"
				step={3}
				title="🔀 PR 점검 모니터링 루프"
				awsValid={!!aws?.valid}
				defaultSec={30}
				secs={[30, 60, 180, 300, 900, 1800]}
			/>

			{/* 🚨 장애 이슈 인박스 — 모니터링 채널의 미해결 이슈를 모아 확인·업무 전환 */}
			<div className="alerts-inbox">
				<div className="ai-head">
					<span className="ai-title">🚨 장애 이슈 인박스</span>
					{alerts && alerts.counts.unresolved > 0 && (
						<span className="cm-badge auth">{alerts.counts.unresolved}건 미확인</span>
					)}
					{alerts && alerts.counts.unresolved === 0 && <span className="cm-badge run">깨끗함</span>}
					<span className="ai-controls">
						<select
							value={alerts?.intervalMs || 0}
							onChange={(e) => setAlInterval(Number(e.target.value))}
							className="sel"
							style={{ maxWidth: 110 }}
							title="자동 읽기 주기 (토큰 사용)"
						>
							<option value={0}>수동</option>
							<option value={600000}>10분 자동</option>
							<option value={1800000}>30분 자동</option>
						</select>
						<button
							className="btn-send"
							onClick={runFetchAlerts}
							disabled={alFetching}
							title="claude가 모니터링 채널을 읽어 미해결 이슈를 가져옵니다 (~30초)"
						>
							{alFetching ? '🚨 읽는 중…' : '🚨 지금 읽기'}
						</button>
					</span>
				</div>
				{alerts && alerts.alerts.filter((a) => !a.resolved && !a.acked).length > 0 ? (
					alerts.alerts
						.filter((a) => !a.resolved && !a.acked)
						.map((a) => (
							<div className="ai-card" key={a.id}>
								<div className="ai-card-top">
									{a.ts && <span className="ai-time">{a.ts}</span>}
									{(a.count ?? 1) > 1 && (
										<span className="ai-count" title={`${a.count}회 반복 발생`}>
											🔁 {a.count}회
										</span>
									)}
									<a
										className="ai-card-title"
										href={a.threadUrl || undefined}
										target="_blank"
										rel="noreferrer"
									>
										{a.title}
									</a>
									<span className="ai-grow" />
									<button
										className="btn-send ai-conv"
										onClick={() => convertAlert(a)}
										disabled={convBusy === a.id}
										title="스레드를 읽어 개발실 일감으로 전환"
									>
										{convBusy === a.id ? '전환 중…' : '🛠️ 업무로 전환'}
									</button>
									<button
										className="btn-dry"
										onClick={() => ackAlert(a.id)}
										title="확인됨 처리(인박스에서 숨김)"
									>
										✅ 확인
									</button>
								</div>
								{(a.source || a.impact || a.status) && (
									<div className="ai-chips">
										{a.source && <span className="ai-chip src">{a.source}</span>}
										{a.impact && (
											<span className="ai-chip impact" title="영향 규모">
												📊 {a.impact}
											</span>
										)}
										{a.status && (
											<span className="ai-chip status" title="현재 상태">
												{a.status}
											</span>
										)}
									</div>
								)}
								{(a.symptom || a.summary) && <p className="ai-card-sum">{a.symptom || a.summary}</p>}
								{a.threadUrl && (
									<a className="ai-card-thread" href={a.threadUrl} target="_blank" rel="noreferrer">
										💬 Slack 스레드 열기 ↗
									</a>
								)}
							</div>
						))
				) : (
					<p className="muted ai-empty">
						미확인 장애 이슈 없음. {alerts?.fetchedAt ? '' : '[🚨 지금 읽기]로 모니터링 채널을 읽어옵니다.'}
					</p>
				)}
				<p className="muted ai-hint">
					claude가 <code>MRM_ALERT_CHANNEL</code>(Slack 채널)을 읽어 미해결 알림을 모읍니다. 새 이슈는 토스트로
					알리고, <b>🛠️ 업무로 전환</b>하면 스레드를 읽어 개발실 일감으로 만들어 ▶진행할 수 있어요.
				</p>
			</div>

			<div className="kpis">
				<div className={`kpi ${c.unresolved ? 'warn' : ''}`}>
					<div className="v">{c.unresolved}</div>
					<div className="l">미해결 특이사항</div>
				</div>
				<div className={`kpi ${c.regression ? 'warn' : ''}`}>
					<div className="v" style={{ color: c.regression ? 'var(--red)' : undefined }}>
						{c.regression}
					</div>
					<div className="l">🔁 재발</div>
				</div>
				<div className="kpi">
					<div className="v">{c.withPr}</div>
					<div className="l">PR 올라옴</div>
				</div>
				<div className="kpi">
					<div className="v" style={{ color: 'var(--green)' }}>
						{c.resolved}
					</div>
					<div className="l">해결됨 (최근)</div>
				</div>
			</div>
			{st.lastError && <div className="err">⚠️ {st.lastError}</div>}

			{regressions.length > 0 && (
				<>
					<h2 className="sec" style={{ color: 'var(--red)' }}>
						🔁 재발 — 머지됐는데 다시 발생 · {regressions.length}
					</h2>
					{regressions.map(row)}
				</>
			)}

			<h2 className="sec">🚧 미해결 · {opens.length}</h2>
			{opens.length ? opens.map(row) : <p className="muted">미해결 특이사항 없음 — 깨끗합니다 ✨</p>}

			{resolved.length > 0 && (
				<>
					<h2 className="sec" style={{ marginTop: 22 }}>
						✅ 최근 해결됨 · {resolved.length}
					</h2>
					{resolved.map(row)}
				</>
			)}

			<h2 className="sec" style={{ marginTop: 22 }}>
				📜 이벤트 로그
			</h2>
			{st.events.length ? (
				<div className="ev-log">
					{st.events.map((e) => (
						<div key={e.id} className={`ev-row lv-${e.level}`}>
							<span className="ev-time">{ago(e.ts)}</span>
							<a className="ev-title" href={e.url || undefined} target="_blank" rel="noreferrer">
								{e.title}
							</a>
							{e.detail && <span className="muted ev-detail">{e.detail}</span>}
						</div>
					))}
				</div>
			) : (
				<p className="muted">아직 이벤트 없음 (감시 시작 후 변화가 생기면 기록됩니다).</p>
			)}

			<div className="callout-box" style={{ marginTop: 16 }}>
				🔔 OpenRM 서버가 <b>{st.intervalMs / 60000}분</b>마다 PR(CI·리뷰)과 이슈를 자동 폴링합니다. 변화 시
				토스트로 알리고 여기에 모읍니다. 해결된 항목이 다시 나타나면 <b>🔁 재발</b>로 표시합니다. 마지막 폴링{' '}
				{ago(st.lastPoll)}.
			</div>

			{/* 🗣️ 리뷰 항의/질문 입력 모달 */}
			{questionModal && (
				<div
					className="rvm-backdrop"
					onClick={() => {
						setQuestionModal(null)
						setQuestionText('')
					}}
				>
					<div className="rvm" onClick={(e) => e.stopPropagation()}>
						<div className="rvm-head">
							<span className="rvm-title" title={questionModal.title}>
								🗣️ 리뷰 항의 · {questionModal.title}
							</span>
							<span className="rc-gap" />
							<button
								className="rvm-x"
								onClick={() => {
									setQuestionModal(null)
									setQuestionText('')
								}}
								title="닫기"
							>
								✕
							</button>
						</div>
						<textarea
							className="rvq-textarea"
							placeholder="변경요청 리뷰에 대한 반박이나 질문을 적어주세요. 답변은 GitHub엔 게시되지 않고 여기(mrm)에서만 보입니다."
							value={questionText}
							onChange={(e) => setQuestionText(e.target.value)}
							rows={5}
							autoFocus
						/>
						<div className="rvq-actions">
							<button
								className="ck-chip ghost"
								onClick={() => {
									setQuestionModal(null)
									setQuestionText('')
								}}
							>
								취소
							</button>
							<button className="ck-chip imp" disabled={!questionText.trim()} onClick={askFinding}>
								보내기
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 🗣️ 답변 보기 모달 */}
			{answerModal && (
				<div className="rvm-backdrop" onClick={() => setAnswerModal(null)}>
					<div className="rvm" onClick={(e) => e.stopPropagation()}>
						<div className="rvm-head">
							<span className="rvm-title" title={answerModal.title}>
								🗣️ {answerModal.title}
							</span>
							<span className="rc-gap" />
							<button className="rvm-x" onClick={() => setAnswerModal(null)} title="닫기">
								✕
							</button>
						</div>
						<div className="rvw-question">
							<div className="rvq-q">🗣️ {answerModal.question.question}</div>
							<div className="rvq-a">
								💬 {answerModal.question.answer}
								{answerModal.question.agreesWithObjection ? ' (이의 인정)' : ''}
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	)
}
