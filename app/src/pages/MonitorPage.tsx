import PageSkeleton from '../components/Skeleton'
import type { Model } from '../types'
import { ago } from '../api'
import AgentCard from '../components/AgentCard'
import Kanban from '../components/Kanban'

export default function MonitorPage({ model }: { model: Model | null }) {
	if (!model) return <PageSkeleton cards rows={6} kpis={4} />
	const c = model.counts

	return (
		<>
			<div className="page-head">
				<h1>📋 감시</h1>
				{model.feature && (
					<span className="feat">
						feature <b>{model.feature}</b>
						{model.phase ? ` · ${model.phase}` : ''}
					</span>
				)}
				{c && (
					<div className="counts">
						<span className="chip">
							🟢 <b>{c.working}</b>
						</span>
						<span className="chip">
							🟡 <b>{c.blocked}</b>
						</span>
						<span className="chip">
							⚪ <b>{c.idle}</b>
						</span>
						<span className="chip">
							백로그 <b>{c.backlogs}</b>
						</span>
					</div>
				)}
			</div>

			{model.error && <div className="err">⚠️ {model.error}</div>}

			<h2 className="sec">에이전트 (근태 · 업무 현황)</h2>
			<div className="agents">
				{model.agents?.length ? (
					model.agents.map((a) => <AgentCard key={a.agent} a={a} />)
				) : (
					<p className="muted">에이전트 없음</p>
				)}
			</div>

			<h2 className="sec">백로그</h2>
			<Kanban model={model} />

			<p className="fresh">
				tmux {ago(model.runtimeFreshness?.tmux)} · 포트 {ago(model.runtimeFreshness?.ports)} · PR{' '}
				{ago(model.runtimeFreshness?.prs)} · 빌드 {model.builtAt?.replace('T', ' ').slice(0, 19)}
			</p>
		</>
	)
}
