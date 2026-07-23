import { useEffect, useState } from 'react'
import XTerm from '../components/XTerm'
import { useIsMobile } from '../hooks/useIsMobile'

// MRM 개선 탭 — ① MRM 레포에서 claude 도는 임베드 터미널(자기 개선) ② 핵심 프롬프트 실시간 편집
interface PromptDef {
	key: string
	group: string
	label: string
	desc: string
	vars: string[]
	default: string
	current: string
	overridden: boolean
}
const post = (url: string, body?: unknown) =>
	fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }).then((r) => r.json())

export default function ImprovePage() {
	const isMobile = useIsMobile()
	// ── 터미널 ──
	const [session, setSession] = useState<string | null>(null)
	const [termErr, setTermErr] = useState<string | null>(null)
	const [termKey, setTermKey] = useState(0) // 재시작용
	useEffect(() => {
		if (isMobile) return // 폰에선 터미널 생략(입력 어려움) — 프롬프트 편집만
		post('/api/mrm/term')
			.then((r: { ok?: boolean; name?: string; error?: string }) => {
				if (r.ok && r.name) setSession(r.name)
				else setTermErr(r.error || '터미널 생성 실패')
			})
			.catch((e) => setTermErr(String(e)))
	}, [isMobile, termKey])

	// ── 프롬프트 편집 ──
	const [prompts, setPrompts] = useState<PromptDef[]>([])
	const [drafts, setDrafts] = useState<Record<string, string>>({})
	const [savedKey, setSavedKey] = useState<string | null>(null)
	const load = () =>
		fetch('/api/prompts')
			.then((r) => r.json())
			.then((d: { prompts?: PromptDef[] }) => {
				setPrompts(d.prompts || [])
				setDrafts((prev) => {
					const next = { ...prev }
					for (const p of d.prompts || []) if (next[p.key] === undefined) next[p.key] = p.current
					return next
				})
			})
			.catch(() => {})
	useEffect(() => {
		load()
	}, [])
	const save = (key: string) => {
		post('/api/prompts/set', { key, template: drafts[key] }).then(() => {
			setSavedKey(key)
			setTimeout(() => setSavedKey(null), 1500)
			load()
		})
	}
	const resetOne = (key: string, def: string) => {
		post('/api/prompts/reset', { key }).then(() => {
			setDrafts((d) => ({ ...d, [key]: def }))
			load()
		})
	}
	const groups = Array.from(new Set(prompts.map((p) => p.group)))

	return (
		<>
			<div className="page-head">
				<h1>🛠️ MRM 개선</h1>
				<p className="muted">MRM 자기 개선 — 이 레포에서 claude를 돌리는 터미널 + 각 기능이 쓰는 프롬프트를 실시간 편집</p>
			</div>

			{/* ① MRM 레포 터미널 */}
			<section className="imp-term-sec">
				<div className="imp-sec-head">
					<span className="imp-sec-title">💻 MRM 레포 터미널</span>
					<span className="muted" style={{ fontSize: 12 }}>cwd: (MRM 레포) · claude</span>
					{!isMobile && (
						<button className="ck-chip ghost" style={{ marginLeft: 'auto' }} onClick={() => { setSession(null); setTermErr(null); setTermKey((k) => k + 1) }} title="새 터미널로 재시작(재접속)">
							↻ 재시작
						</button>
					)}
				</div>
				{isMobile ? (
					<div className="imp-term-mobile muted">📱 폰에서는 터미널을 생략합니다 — 맥에서 열어 MRM을 직접 개선하세요. (아래 프롬프트 편집은 폰에서도 가능)</div>
				) : termErr ? (
					<div className="err">⚠️ {termErr}</div>
				) : session ? (
					<div className="imp-term-host">
						<XTerm key={termKey} session={session} />
					</div>
				) : (
					<div className="muted" style={{ padding: 16 }}>터미널 준비 중…</div>
				)}
			</section>

			{/* ② 프롬프트 편집 */}
			<section className="imp-prompts-sec">
				<div className="imp-sec-head">
					<span className="imp-sec-title">✍️ 프롬프트 실시간 편집</span>
					<span className="muted" style={{ fontSize: 12 }}>여기 프롬프트는 실제 기능이 런타임에 읽습니다. 저장 즉시 반영 · {'{토큰}'}은 실행 시 값으로 치환</span>
				</div>
				{groups.map((g) => (
					<div className="imp-group" key={g}>
						<div className="imp-group-label">{g}</div>
						{prompts
							.filter((p) => p.group === g)
							.map((p) => {
								const dirty = drafts[p.key] !== p.current
								return (
									<div className="imp-prompt" key={p.key}>
										<div className="imp-prompt-head">
											<span className="imp-prompt-label">{p.label}</span>
											<code className="imp-prompt-key">{p.key}</code>
											{p.overridden && <span className="imp-badge ovr">수정됨</span>}
											<span className="imp-grow" />
											{p.vars.map((v) => (
												<code className="imp-var" key={v} title="실행 시 값으로 치환되는 토큰">{`{${v}}`}</code>
											))}
										</div>
										<p className="imp-prompt-desc">{p.desc}</p>
										<textarea
											className="imp-textarea"
											value={drafts[p.key] ?? ''}
											spellCheck={false}
											onChange={(e) => setDrafts((d) => ({ ...d, [p.key]: e.target.value }))}
											rows={Math.min(16, Math.max(5, (drafts[p.key] || '').split('\n').length + 1))}
										/>
										<div className="imp-prompt-ctl">
											<button className="ck-chip imp" disabled={!dirty} onClick={() => save(p.key)}>
												{savedKey === p.key ? '✅ 저장됨' : dirty ? '💾 저장' : '변경 없음'}
											</button>
											<button className="ck-chip ghost" disabled={!p.overridden && !dirty} onClick={() => resetOne(p.key, p.default)} title="기본 프롬프트로 되돌리기">
												↩︎ 기본값
											</button>
										</div>
									</div>
								)
							})}
					</div>
				))}
				{!prompts.length && <p className="muted" style={{ padding: 12 }}>불러오는 중…</p>}
			</section>
		</>
	)
}
