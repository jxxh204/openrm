import { useEffect, useRef, useState } from 'react'
import type { Model } from './types'

type ConnState = 'connecting' | 'live' | 'reconnecting'

// SSE(/events)로 실시간 모델 구독. 끊기면 자동 재연결, 초기엔 /api/model로 즉시 1회.
export function useModel(): { model: Model | null; conn: ConnState } {
	const [model, setModel] = useState<Model | null>(null)
	const [conn, setConn] = useState<ConnState>('connecting')
	const esRef = useRef<EventSource | null>(null)

	useEffect(() => {
		let closed = false

		fetch('/api/model')
			.then((r) => r.json())
			.then((m) => !closed && setModel(m))
			.catch(() => {})

		const es = new EventSource('/events')
		esRef.current = es
		es.onopen = () => setConn('live')
		es.onmessage = (e) => {
			try {
				setModel(JSON.parse(e.data))
			} catch {
				/* ignore */
			}
		}
		es.onerror = () => setConn('reconnecting')

		return () => {
			closed = true
			es.close()
		}
	}, [])

	return { model, conn }
}

export function ago(ts: number | string | null | undefined): string {
	if (!ts) return '—'
	const t = typeof ts === 'number' ? ts : new Date(ts).getTime()
	if (!t) return '—'
	const d = (Date.now() - t) / 1000
	if (d < 60) return `${Math.floor(d)}s 전`
	if (d < 3600) return `${Math.floor(d / 60)}m 전`
	if (d < 86400) return `${Math.floor(d / 3600)}h 전`
	return `${Math.floor(d / 86400)}d 전`
}
