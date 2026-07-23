import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// 사이드 메뉴 정기배포 위젯 — 최대 1개라 작은 버튼 + 모달. 없으면 만들기, 있으면 PR/노션 링크 + 삭제.
interface DeployItem {
	branch: string
	notionUrl: string | null
	branchUrl: string
	pr: { number: number; url: string; state: string; title: string } | null
	worktree: string | null
}
const tpost = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())

export default function DeployWidget() {
	const [deploys, setDeploys] = useState<DeployItem[]>([])
	const [open, setOpen] = useState(false)
	const [notion, setNotion] = useState('')
	const [num, setNum] = useState('')
	const [busy, setBusy] = useState(false)
	const [msg, setMsg] = useState<string | null>(null)
	const [groups, setGroups] = useState<string[]>([]) // 작업 그룹 (백로그 연결 기준)
	const [linkGroup, setLinkGroup] = useState('')
	const [linkBusy, setLinkBusy] = useState(false)
	const [notionEdit, setNotionEdit] = useState('')
	const [notionSaving, setNotionSaving] = useState(false)

	const load = () => {
		fetch('/api/deploy')
			.then((r) => r.json())
			.then((d) => d.ok && setDeploys(d.deploys))
			.catch(() => {})
		fetch('/api/tasks')
			.then((r) => r.json())
			.then((d) => d.ok && setGroups(d.groups || []))
			.catch(() => {})
	}
	useEffect(() => {
		const t = setTimeout(load, 1000) // 첫 호출 지연 — /api/deploy(느림)가 보드 로딩을 막지 않게
		const id = setInterval(load, 30000)
		return () => {
			clearTimeout(t)
			clearInterval(id)
		}
	}, [])
	const cur = deploys[0] || null

	const create = () => {
		const n = notion.trim()
		const v = num.trim()
		if (!v && !/\d/.test(n)) {
			setMsg('배포 번호를 입력하세요 (예: 286)')
			return
		}
		setBusy(true)
		setMsg(null)
		tpost('/api/deploy/create', { notionUrl: n || undefined, num: v || undefined, input: n + ' ' + v })
			.then((d: { ok?: boolean; branch?: string; pushed?: boolean; pushError?: string; error?: string }) => {
				if (d.ok) {
					setMsg(`✅ ${d.branch}` + (d.pushed ? ' + push' : ` (push 실패: ${d.pushError || '?'})`))
					setNotion('')
					setNum('')
					load()
				} else setMsg('⚠️ ' + (d.error || '실패'))
			})
			.catch((e) => setMsg('⚠️ ' + String(e)))
			.finally(() => setBusy(false))
	}
	// 배포 카드 백로그 relation에 선택 작업 그룹의 노션 백로그 연결 (에이전트 경유)
	const linkBacklogs = () => {
		if (!linkGroup) {
			setMsg('연결할 작업 그룹을 선택하세요')
			return
		}
		setLinkBusy(true)
		setMsg(null)
		tpost('/api/deploy/link-backlogs', { group: linkGroup, deployNotionUrl: cur?.notionUrl })
			.then((d: { ok?: boolean; candidates?: number; error?: string }) => setMsg(d.ok ? `📎 '${linkGroup}' 백로그 연결 중… (${d.candidates}건, 에이전트가 Notion 갱신)` : '⚠️ ' + (d.error || '실패')))
			.catch((e) => setMsg('⚠️ ' + String(e)))
			.finally(() => setLinkBusy(false))
	}
	// 기존 배포 브랜치 카드에 노션 링크를 나중에 연결 (생성 시 비워둔 경우)
	const saveNotion = () => {
		const n = notionEdit.trim()
		if (!n || !cur) return
		setNotionSaving(true)
		setMsg(null)
		tpost('/api/deploy/set-notion', { branch: cur.branch, notionUrl: n })
			.then((d: { ok?: boolean; error?: string }) => {
				if (d.ok) {
					setNotionEdit('')
					load()
				} else setMsg('⚠️ ' + (d.error || '실패'))
			})
			.catch((e) => setMsg('⚠️ ' + String(e)))
			.finally(() => setNotionSaving(false))
	}
	const remove = (branch: string) => {
		if (!confirm(`${branch} 삭제 — 워크트리(있으면) + 로컬/원격 브랜치를 모두 삭제합니다.\n개발·배포가 끝난 경우에만. 되돌릴 수 없습니다.`)) return
		tpost('/api/deploy/remove', { branch }).then((d: { errors?: string[] }) => {
			if (d.errors && d.errors.length) alert('일부 실패:\n' + d.errors.join('\n'))
			load()
		})
	}

	return (
		<>
			<button className={`deploy-side ${cur ? 'has' : ''}`} onClick={() => { setOpen(true); load() }} title="정기배포 브랜치">
				🚀 {cur ? cur.branch : '배포 브랜치'}
				{cur?.pr && <span className="ds-pr"> 🔀#{cur.pr.number}</span>}
			</button>

			{open &&
				createPortal(
					<div className="modal-backdrop" onClick={() => setOpen(false)}>
						<div className="modal" onClick={(e) => e.stopPropagation()}>
						<div className="modal-head">
							<b>🚀 정기배포 브랜치</b>
							<button className="modal-x" onClick={() => setOpen(false)}>✕</button>
						</div>
						{cur ? (
							<div className="modal-body">
								<div className="dep-cur">
									<code>{cur.branch}</code>
									{cur.worktree && <span className="dep-wt"> · 🌿 워크트리</span>}
								</div>
								<div className="dep-links">
									{cur.pr ? (
										<a href={cur.pr.url} target="_blank" rel="noreferrer">🔀 PR #{cur.pr.number} ({cur.pr.state})</a>
									) : (
										<span className="muted">🔀 PR 없음</span>
									)}
									{cur.notionUrl ? (
										<a href={cur.notionUrl} target="_blank" rel="noreferrer">📄 노션 카드</a>
									) : (
										<span className="muted">📄 노션 링크 없음</span>
									)}
									<a href={cur.branchUrl} target="_blank" rel="noreferrer">🌿 GitHub 브랜치</a>
								</div>
								{!cur.notionUrl && (
									<div className="dep-linkbl">
										<span className="dep-linkbl-label">📄 노션 연결</span>
										<input
											className="tl-input"
											placeholder="https://notion.so/…"
											value={notionEdit}
											onChange={(e) => setNotionEdit(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === 'Enter') saveNotion()
											}}
											disabled={notionSaving}
										/>
										<button className="btn-dry" onClick={saveNotion} disabled={notionSaving || !notionEdit.trim()}>
											{notionSaving ? '저장 중…' : '저장'}
										</button>
									</div>
								)}
								<div className="dep-linkbl">
									<span className="dep-linkbl-label">📎 백로그 연결</span>
									<select className="tl-input" value={linkGroup} onChange={(e) => setLinkGroup(e.target.value)} disabled={linkBusy}>
										<option value="">작업 그룹 선택…</option>
										{groups.map((g) => (
											<option key={g} value={g}>{g}</option>
										))}
									</select>
									<button className="btn-dry" onClick={linkBacklogs} disabled={linkBusy || !cur.notionUrl} title={cur.notionUrl ? '이 그룹의 노션 백로그를 배포 카드에 연결(에이전트)' : '노션 카드가 없어 연결 불가'}>
										{linkBusy ? '📎…' : '연결'}
									</button>
								</div>
								{msg && <div className="muted dep-msg">{msg}</div>}
								<button className="btn-dry dep-remove" onClick={() => remove(cur.branch)}>🗑 삭제 (워크트리 + 로컬/원격 브랜치)</button>
								<p className="muted dep-note">개발·배포가 끝나면 삭제하세요.</p>
							</div>
						) : (
							<div className="modal-body">
								<label className="dep-field">
									<span>노션 링크 (배포 DB 카드)</span>
									<input className="tl-input" placeholder="https://notion.so/…" value={notion} onChange={(e) => setNotion(e.target.value)} disabled={busy} />
								</label>
								<label className="dep-field">
									<span>배포 번호 (노션 ID)</span>
									<input
										className="tl-input"
										placeholder="286"
										value={num}
										onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))}
										onKeyDown={(e) => {
											if (e.key === 'Enter') create()
										}}
										disabled={busy}
									/>
								</label>
								<button className="btn-send" onClick={create} disabled={busy}>
									{busy ? '생성 중…' : '＋ deploy 브랜치 만들기'}
								</button>
								<p className="muted dep-note">develop 기준 <code>deploy-&lt;번호&gt;</code> 생성 + origin push.</p>
								{msg && <div className="muted dep-msg">{msg}</div>}
							</div>
						)}
					</div>
				</div>,
			document.body,
			)}
		</>
	)
}
