import type { CSSProperties } from 'react'
import type { Agent } from '../types'

// VITE_GH_REPO="owner/repo" 로 설정하면 PR 배지가 링크로 뜸. 미설정이면 텍스트만 표시.
const GH_REPO = import.meta.env.VITE_GH_REPO as string | undefined
const PR_BASE = GH_REPO ? `https://github.com/${GH_REPO}/pull/` : null

export default function AgentCard({ a }: { a: Agent }) {
	const s = a.status
	return (
		<div className="agent" style={{ '--c': a.color } as CSSProperties}>
			<div className="top">
				<span className={`pulse ${s.dot}`} />
				<span className="name">{a.agent}</span>
				<span className={`st ${s.code}`}>{s.label}</span>
			</div>

			<div className="row">
				<span className="k">현재</span>
				{a.currentBacklog ? <code>{a.currentBacklog}</code> : <span className="muted">—</span>}
				{a.pr && (
					<>
						{' · '}
						{PR_BASE ? (
							<a href={`${PR_BASE}${a.pr}`} target="_blank" rel="noreferrer">
								PR #{a.pr}
							</a>
						) : (
							<span>PR #{a.pr}</span>
						)}
					</>
				)}
			</div>

			<div className="row">
				<span className="k">chain</span>
				<span className="muted ell">
					{a.chain.slice(0, 4).join(' → ') || '—'}
					{a.chain.length > 4 ? ' …' : ''}
				</span>
			</div>

			<div className="row">
				<span className="k">tmux</span>
				<code>{a.tmuxSession || '—'}</code>
				<span className={`dot ${a.tmuxAlive ? 'up' : 'down'}`} />
				{a.devUrl && (
					<>
						{' · '}
						<a href={a.devUrl} target="_blank" rel="noreferrer">
							dev
						</a>
					</>
				)}
				{a.devPortUp != null && (
					<span style={{ marginLeft: 6 }}>
						<span className={`dot ${a.devPortUp ? 'up' : 'down'}`} /> :{a.ports?.dev}
					</span>
				)}
			</div>

			{a.leadNote && (
				<div className="row">
					<span className="k">노트</span>
					<span className="muted ell">{a.leadNote}</span>
				</div>
			)}

			<div className={`out ${a.lastOutput ? '' : 'empty'}`}>{a.lastOutput || '(tmux 출력 없음)'}</div>
		</div>
	)
}
