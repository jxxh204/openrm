import { useEffect, useState } from 'react'

// 모니터 특이사항 → 글로벌 토스트. /api/monitor/events SSE 구독, 새 이벤트만 띄움(접속 후 발생분).
interface Ev {
	id: number
	ts: number
	kind: string
	level: 'good' | 'warn' | 'bad' | 'info'
	title: string
	detail?: string
	url?: string | null
	repo?: string
}

export default function Toaster() {
	const [toasts, setToasts] = useState<Ev[]>([])

	useEffect(() => {
		let es: EventSource | null = null
		let closed = false
		const connect = () => {
			es = new EventSource('/api/monitor/events')
			es.onmessage = (e) => {
				try {
					const ev: Ev = JSON.parse(e.data)
					setToasts((t) => [...t.slice(-5), ev]) // 최대 6개 스택
					setTimeout(() => setToasts((t) => t.filter((x) => x.id !== ev.id)), ev.level === 'bad' ? 14000 : 8000)
				} catch {
					/* ignore */
				}
			}
			es.onerror = () => {
				es?.close()
				if (!closed) setTimeout(connect, 3000)
			}
		}
		connect()
		return () => {
			closed = true
			es?.close()
		}
	}, [])

	const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id))
	if (!toasts.length) return null
	return (
		<div className="toaster">
			{toasts.map((t) => (
				<div
					key={t.id}
					className={`toast lv-${t.level}`}
					onClick={() => {
						if (t.url) window.open(t.url, '_blank')
						dismiss(t.id)
					}}
				>
					<div className="toast-title">{t.title}</div>
					{t.detail && <div className="toast-detail">{t.detail}</div>}
					<button
						className="toast-x"
						onClick={(e) => {
							e.stopPropagation()
							dismiss(t.id)
						}}
					>
						✕
					</button>
				</div>
			))}
		</div>
	)
}
