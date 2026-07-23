import type { Lane, Model } from '../types'

const COLS: { key: Lane; label: string }[] = [
	{ key: 'plan', label: '계획/대기' },
	{ key: 'progress', label: '진행' },
	{ key: 'review', label: '리뷰' },
	{ key: 'hold', label: '보류' },
	{ key: 'done', label: '완료' },
]

export default function Kanban({ model }: { model: Model }) {
	return (
		<div className="kanban">
			{COLS.map(({ key, label }) => {
				const items = model.backlogs?.[key] || []
				return (
					<div className="col" key={key}>
						<h3>
							{label}
							<span className="cnt">{items.length}</span>
						</h3>
						{items.slice(0, 25).map((b) => (
							<div className="bl" key={b.id}>
								<span className="id">{b.id}</span>
								{b.prUrl && (
									<>
										{' · '}
										<a href={b.prUrl} target="_blank" rel="noreferrer">
											PR{b.pr ? ` #${b.pr}` : ''}
										</a>
									</>
								)}
								{b.notionUrl && (
									<>
										{' · '}
										<a href={b.notionUrl} target="_blank" rel="noreferrer">
											노션
										</a>
									</>
								)}
								<span className="t">{b.title}</span>
							</div>
						))}
						{items.length > 25 && (
							<div className="muted" style={{ fontSize: 11 }}>
								+{items.length - 25}…
							</div>
						)}
					</div>
				)
			})}
		</div>
	)
}
