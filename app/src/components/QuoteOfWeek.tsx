import { useEffect, useState } from 'react'

// 매주 바뀌는 명언 — 기본은 ISO 주차 기준 자동 로테이션, 원하면 이번 주 문구를 직접 입력해 덮어쓸 수 있다.
// 덮어쓴 문구는 /api/settings(.mrm-settings.json)에 주차 키와 함께 저장되어 폰/PC 어디서나 공유되고,
// 주가 바뀌면(주차 키 불일치) 자동으로 다시 로테이션 문구로 돌아간다.
const QUOTES: { text: string; author: string }[] = [
	{ text: '단순함은 궁극의 정교함이다.', author: '레오나르도 다빈치' },
	{ text: '완벽함이란 더할 것이 없을 때가 아니라, 더 뺄 것이 없을 때 완성된다.', author: '앙투안 드 생텍쥐페리' },
	{ text: '먼저 작동하게 만들고, 그다음 올바르게, 그다음 빠르게 만들어라.', author: '켄트 벡' },
	{ text: '나은 방법이 늦게라도 발견되면, 늦기 전에 바꿔라.', author: '작자 미상' },
	{ text: '오늘 하지 않아도 되는 일을 내일로 미루지 마라, 다만 지금 할 필요가 없는 일은 지금 하지 마라.', author: '마크 트웨인' },
	{ text: '측정할 수 없으면 개선할 수 없다.', author: '피터 드러커' },
	{ text: '좋은 코드는 그 자체가 최고의 문서다.', author: '스티브 맥코넬' },
	{ text: '실패는 성공으로 가는 과정의 일부일 뿐이다.', author: '아리아나 허핑턴' },
	{ text: '가장 빠른 코드는 실행되지 않는 코드다.', author: '작자 미상' },
	{ text: '계획은 쓸모없지만, 계획하는 과정은 반드시 필요하다.', author: '드와이트 아이젠하워' },
	{ text: '시작이 반이다.', author: '아리스토텔레스' },
	{ text: '위대한 일은 혼자 하는 것이 아니라 팀이 하는 것이다.', author: '스티브 잡스' },
	{ text: '어제와 똑같이 살면서 다른 미래를 기대하는 것은 어리석다.', author: '알베르트 아인슈타인' },
	{ text: '집중은 무엇을 할지 정하는 것이 아니라, 무엇을 하지 않을지 정하는 것이다.', author: '스티브 잡스' },
	{ text: '천 리 길도 한 걸음부터.', author: '노자' },
	{ text: '늦더라도 하지 않는 것보다 낫다.', author: '작자 미상' },
	{ text: '단순하게 만들되, 더 단순하게 만들지는 마라.', author: '알베르트 아인슈타인' },
	{ text: '가장 큰 위험은 아무 위험도 감수하지 않는 것이다.', author: '마크 저커버그' },
	{ text: '변하지 않는 유일한 것은 변한다는 사실뿐이다.', author: '헤라클레이토스' },
	{ text: '좋은 판단은 경험에서, 경험은 나쁜 판단에서 나온다.', author: '작자 미상' },
	{ text: '오늘 걷지 않으면 내일은 뛰어야 한다.', author: '작자 미상' },
	{ text: '문제를 정확히 정의하면 절반은 푼 것이다.', author: '찰스 케터링' },
	{ text: '탁월함은 습관이다.', author: '아리스토텔레스' },
	{ text: '기록되지 않은 생각은 흘러가지만, 기록된 생각은 쌓인다.', author: '작자 미상' },
	{ text: '지금 심는 나무의 그늘은 내가 아니라 다음 사람이 누린다.', author: '그리스 속담' },
	{ text: '해보기 전까지는 늘 불가능해 보인다.', author: '넬슨 만델라' },
]

function getIsoWeekKey(d: Date): number {
	const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
	const dayNum = (date.getUTCDay() + 6) % 7 // 월=0 ... 일=6
	date.setUTCDate(date.getUTCDate() - dayNum + 3) // 이번 주 목요일로 이동
	const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
	const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
	firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
	const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
	return date.getUTCFullYear() * 53 + week
}

function autoQuoteOfWeek(weekKey: number) {
	return QUOTES[((weekKey % QUOTES.length) + QUOTES.length) % QUOTES.length]
}

type QuoteOverride = { weekKey: number; text: string; author?: string }

export default function QuoteOfWeek({ variant = 'sidebar' }: { variant?: 'sidebar' | 'strip' }) {
	const weekKey = getIsoWeekKey(new Date())
	const fallback = autoQuoteOfWeek(weekKey)
	const [override, setOverride] = useState<QuoteOverride | null>(null)
	const [editing, setEditing] = useState(false)
	const [draftText, setDraftText] = useState('')
	const [draftAuthor, setDraftAuthor] = useState('')

	useEffect(() => {
		fetch('/api/settings')
			.then((r) => r.json())
			.then((d) => {
				if (d?.ok && d.settings?.quoteOverride?.text) setOverride(d.settings.quoteOverride)
			})
			.catch(() => {})
	}, [])

	const active = override && override.weekKey === weekKey && override.text.trim() ? override : null
	const q = active || fallback

	const startEdit = () => {
		setDraftText(q.text)
		setDraftAuthor(!q.author || q.author === '작자 미상' ? '' : q.author)
		setEditing(true)
	}
	const cancelEdit = () => setEditing(false)
	const save = () => {
		const text = draftText.trim()
		const next: QuoteOverride = { weekKey, text, author: draftAuthor.trim() }
		setOverride(text ? next : null)
		setEditing(false)
		fetch('/api/settings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ quoteOverride: next }),
		}).catch(() => {})
	}
	const resetToAuto = () => {
		setOverride(null)
		setEditing(false)
		fetch('/api/settings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ quoteOverride: { weekKey, text: '', author: '' } }),
		}).catch(() => {})
	}

	if (variant === 'strip') {
		if (editing) {
			return (
				<div className="quote-strip editing">
					<input
						className="qs-input"
						value={draftText}
						onChange={(e) => setDraftText(e.target.value)}
						placeholder="이번 주 명언을 입력하세요"
						autoFocus
						onKeyDown={(e) => e.key === 'Enter' && save()}
					/>
					<input className="qs-input-author" value={draftAuthor} onChange={(e) => setDraftAuthor(e.target.value)} placeholder="작성자" />
					<button className="qs-btn qs-save" onClick={save} aria-label="저장">
						✓
					</button>
					<button className="qs-btn" onClick={cancelEdit} aria-label="취소">
						✕
					</button>
				</div>
			)
		}
		return (
			<div className="quote-strip" onClick={startEdit} title={`${q.text} — ${q.author}\n(탭해서 이번 주 문구 직접 입력)`}>
				<span className="qs-ico">❝</span>
				<span className="qs-text">{q.text}</span>
				<span className="qs-author">{q.author}</span>
				<span className="qs-editico">✏️</span>
			</div>
		)
	}

	return (
		<div className="quote-week">
			{editing ? (
				<div className="qw-edit">
					<div className="qw-label">이번 주의 한마디 — 직접 입력</div>
					<textarea className="qw-input" rows={3} value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder="이번 주 명언을 입력하세요" autoFocus />
					<input className="qw-input-author" value={draftAuthor} onChange={(e) => setDraftAuthor(e.target.value)} placeholder="작성자(선택)" />
					<div className="qw-edit-actions">
						{active && (
							<button className="qw-reset" onClick={resetToAuto}>
								자동으로
							</button>
						)}
						<button className="qw-save" onClick={save}>
							저장
						</button>
						<button className="qw-cancel" onClick={cancelEdit}>
							취소
						</button>
					</div>
				</div>
			) : (
				<>
					<div className="qw-label-row">
						<div className="qw-label">이번 주의 한마디</div>
						<button className="qw-edit-btn" onClick={startEdit} title="이번 주 문구를 직접 입력">
							✏️
						</button>
					</div>
					<blockquote className="qw-text">“{q.text}”</blockquote>
					<div className="qw-author">— {q.author}</div>
				</>
			)}
		</div>
	)
}
