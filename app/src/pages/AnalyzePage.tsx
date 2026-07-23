import PageSkeleton from '../components/Skeleton'
import { useEffect, useState } from 'react'
import type { Analysis } from '../types'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const RANGES = [30, 90, 180]

function HBar({ name, value, max, kind }: { name: string; value: number; max: number; kind?: string }) {
	return (
		<div className="hrow">
			<span className="name">{name}</span>
			<span className="track">
				<span className={`fill ${kind || ''}`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
			</span>
			<span className="num">{value.toLocaleString()}</span>
		</div>
	)
}

export default function AnalyzePage() {
	const [data, setData] = useState<Analysis | null>(null)
	const [days, setDays] = useState(90)
	const [loading, setLoading] = useState(true)

	const load = (d: number) => {
		setLoading(true)
		fetch(`/api/analyze?days=${d}`)
			.then((r) => r.json())
			.then((j) => setData(j))
			.catch(() => {})
			.finally(() => setLoading(false))
	}
	useEffect(() => load(days), [days])

	const hourMax = data ? Math.max(...data.byHour, 1) : 1
	const wdMax = data ? Math.max(...data.byWeekday, 1) : 1
	const churnMax = data ? Math.max(...data.domainChurn.map((c) => c.add + c.del), 1) : 1
	const utilMax = data ? Math.max(...data.agentUtil.map((a) => a.chainLen), 1) : 1
	const dayMax = data ? Math.max(...data.byDay.map((d) => d.count), 1) : 1

	return (
		<>
			<div className="page-head">
				<h1>📊 조사</h1>
				<span className="feat">내 작업 방식 · git {days}일 채굴</span>
				<div className="toolbar">
					{RANGES.map((d) => (
						<button key={d} className={d === days ? 'on' : ''} onClick={() => setDays(d)}>
							{d}일
						</button>
					))}
					<button onClick={() => load(days)}>↻</button>
				</div>
			</div>

			{loading && !data && <PageSkeleton head={false} kpis={5} rows={5} />}
			{data?.error && <div className="err">⚠️ {data.error}</div>}

			{data && !data.error && (
				<>
					<div className="kpis">
						<div className="kpi">
							<div className="v">{data.range.totalCommits.toLocaleString()}</div>
							<div className="l">총 커밋 ({data.range.since}~)</div>
						</div>
						<div className="kpi">
							<div className="v">
								{data.activeDays}
								<small> 일</small>
							</div>
							<div className="l">활동일 (커밋 있던 날)</div>
						</div>
						<div className={`kpi ${data.nightRatio > 0.15 ? 'warn' : ''}`}>
							<div className="v">
								{(data.nightRatio * 100).toFixed(1)}
								<small>%</small>
							</div>
							<div className="l">야간 작업 (22~06시)</div>
						</div>
						<div className="kpi">
							<div className="v">
								{data.byHour.indexOf(Math.max(...data.byHour))}
								<small>시</small>
							</div>
							<div className="l">최다 커밋 시간대</div>
						</div>
						<div className="kpi">
							<div className="v">{data.backlogTotal}</div>
							<div className="l">
								백로그 (
								{Object.entries(data.backlogLanes)
									.map(([k, v]) => `${k} ${v}`)
									.join(' · ')}
								)
							</div>
						</div>
					</div>

					<div className="panel">
						<h3>시간대 분포 (보라 = 야간 22~06시)</h3>
						<div className="vbars">
							{data.byHour.map((v, h) => (
								<div
									className={`b ${h >= 22 || h < 6 ? 'night' : ''}`}
									key={h}
									title={`${h}시 · ${v} 커밋`}
								>
									<span className="bar" style={{ height: `${(v / hourMax) * 100}%` }} />
									<span className="lbl">{h % 3 === 0 ? h : ''}</span>
								</div>
							))}
						</div>
					</div>

					<div className="grid2">
						<div className="panel">
							<h3>도메인별 변경량 (최근 30일 · 초록 +추가 / 빨강 -삭제)</h3>
							{data.domainChurn.map((c) => (
								<div className="hrow" key={c.path}>
									<span className="name" title={c.path}>
										{c.path}
									</span>
									<span className="track">
										<span className="fill add" style={{ width: `${(c.add / churnMax) * 100}%` }} />
										<span className="fill del" style={{ width: `${(c.del / churnMax) * 100}%` }} />
									</span>
									<span className="num">+{(c.add / 1000).toFixed(1)}k</span>
								</div>
							))}
						</div>

						<div className="panel">
							<h3>요일 분포</h3>
							{data.byWeekday.map((v, i) => (
								<HBar key={i} name={WEEKDAYS[i] + '요일'} value={v} max={wdMax} />
							))}
							<h3 style={{ marginTop: 18 }}>커밋한 사람</h3>
							{data.topAuthors.map((a) => (
								<HBar key={a.name} name={a.name} value={a.count} max={data.topAuthors[0]?.count || 1} />
							))}
						</div>
					</div>

					<div className="grid2">
						<div className="panel">
							<h3>최근 30일 커밋 추세</h3>
							<div className="spark">
								{data.byDay.map((d) => (
									<span
										className="s"
										key={d.date}
										style={{ height: `${(d.count / dayMax) * 100}%` }}
										title={`${d.date} · ${d.count}`}
									/>
								))}
							</div>
						</div>
						<div className="panel">
							<h3>에이전트 가동률 (chain 길이)</h3>
							{data.agentUtil.length ? (
								data.agentUtil.map((a) => (
									<HBar
										key={a.agent}
										name={`${a.alive ? '🟢' : '⚪'} ${a.agent}`}
										value={a.chainLen}
										max={utilMax}
									/>
								))
							) : (
								<p className="muted">에이전트 없음</p>
							)}
						</div>
					</div>

					<p className="fresh">빌드 {data.builtAt.replace('T', ' ').slice(0, 19)} · 60초 캐시</p>
				</>
			)}
		</>
	)
}
