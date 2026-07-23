import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// 전역 진행바 — claude 잡(스레드 일감·백로그 생성)을 앱 레벨에서 추적. 페이지 이동에도 안 사라짐.
interface Job {
	jobId: string
	kind: string
	percent: number
	label: string
}
interface Done {
	jobId: string
	kind: string
	result: { ok?: boolean; key?: string; ticket?: string; title?: string; error?: string }
	doneAt: number
}
const kindLabel = (k: string) => (k === 'backlog' ? '📋 백로그 생성' : k === 'enrich' ? '🧵 스레드 일감' : '⏳ 작업')

export default function JobBar() {
	const [active, setActive] = useState<Job[]>([])
	const [recent, setRecent] = useState<Done[]>([])
	const [dismissed, setDismissed] = useState<Set<string>>(new Set())
	const nav = useNavigate()

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout>
		let alive = true
		const tick = () =>
			fetch('/api/tasks/jobs')
				.then((r) => r.json())
				.then((d: { active?: Job[]; recent?: Done[] }) => {
					if (!alive) return
					setActive(d.active || [])
					setRecent(d.recent || [])
					timer = setTimeout(tick, d.active && d.active.length ? 900 : 3000)
				})
				.catch(() => {
					if (alive) timer = setTimeout(tick, 3000)
				})
		tick()
		return () => {
			alive = false
			clearTimeout(timer)
		}
	}, [])

	const shownRecent = recent.filter((r) => !dismissed.has(r.jobId))
	if (!active.length && !shownRecent.length) return null
	const dismiss = (id: string) => setDismissed((s) => new Set(s).add(id))

	return (
		<div className="jobbar">
			{active.map((j) => (
				<div className="jb-pill" key={j.jobId}>
					<span className="jb-k">{kindLabel(j.kind)}</span>
					<div className="jb-bar">
						<div className="jb-fill" style={{ width: `${j.percent}%` }} />
					</div>
					<span className="jb-l">
						{j.percent}% · {j.label}
					</span>
				</div>
			))}
			{shownRecent.map((r) => (
				<div className={`jb-pill done ${r.result?.ok ? 'ok' : 'err'}`} key={r.jobId}>
					<span className="jb-k">{kindLabel(r.kind)}</span>
					{r.result?.ok ? (
						<span className="jb-l">
							✅ {r.kind === 'backlog' ? '백로그 생성됨' : '일감 생성됨'}
							{r.result.ticket || r.result.key ? ` · ${r.result.ticket || r.result.key}` : ''}
						</span>
					) : (
						<span className="jb-l">⚠️ {r.result?.error || '실패'}</span>
					)}
					{r.result?.ok && (
						<button
							className="jb-go"
							onClick={() => {
								nav('/sessions')
								dismiss(r.jobId)
							}}
						>
							개발실로 →
						</button>
					)}
					<button className="jb-x" onClick={() => dismiss(r.jobId)}>
						✕
					</button>
				</div>
			))}
		</div>
	)
}
