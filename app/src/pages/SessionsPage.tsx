import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import XTerm from '../components/XTerm'
import ConductorConsole from '../components/ConductorConsole'
import PageSkeleton from '../components/Skeleton'
import { ago } from '../api'

// 병렬 개발 콕핏 — 작업 스트림(워크트리: git·PR/CI·dev서버) + MRM 호스팅 터미널 + cmux 세션 인수.
interface PR {
	number: number
	state: string
	draft: boolean
	ci: string
	review: string | null
	url: string
}
interface Stream {
	path: string
	name: string
	branch: string
	ticket: string | null
	isMain: boolean
	dirty: number
	ahead: number
	behind: number
	lastRel: string | null
	lastSubject: string | null
	pr: PR | null
	dev: { port: number; kind: string }[]
}
interface DevServer {
	port: number
	kind: string
	ticket: string | null
	cwd: string
}
interface NowItem {
	ticket: string | null
	name: string
	branch: string
	touchedMs: number
	touchedFile: string | null
	dirty: number
	pr: PR | null
	isMain: boolean
}
interface Cockpit {
	ok: boolean
	now?: { focused: { ticket?: string | null; name: string; branch?: string; path: string } | null; recent: NowItem[] }
	summary?: {
		devCount: number
		streamsTotal: number
		streamsActive: number
		dirty: number
		prOpen: number
		prDraft: number
		ciFail: number
	}
	devServers: DevServer[]
	active: Stream[]
	streamsTotal: number
	prError?: string | null
}
interface TermStatus {
	exists?: boolean
	working?: boolean
	waiting?: boolean
	needsAuth?: boolean
	isClaude?: boolean
	tail?: string
}
interface TermSession {
	name: string
	label: string
	cwd: string
	command: string
	attached: boolean
	created: number | null
	status?: TermStatus | null
	model?: string | null // 배분된 모델 (실시간 표기)
}
interface CmuxSession {
	sessionId: string
	pid: number
	cwd: string
	title: string
	workspace: string | null
	surfaceRef: string | null
}

// 업무 보드 — 업무(티켓) > 스레드/노션/피그마/작업 스트림
type LinkKind = 'slack' | 'notion' | 'figma'
interface WorkItem {
	key: string
	ticket: string | null
	title: string
	summary?: string | null
	group?: string | null
	noWorktree?: boolean
	streams: Stream[]
	links: Record<LinkKind, string[]>
	prs: {
		number: number
		repo: string
		url: string
		title: string
		state?: string
		draft?: boolean
		ci?: string
		mine?: boolean
		author?: string | null
		surface?: string | null
		branch?: string | null
		reviewDecision?: string | null
	}[]
	manual: boolean
	score: number
	linkCount: number
	devServer?: string | null // 마티가 지정한 배포 dev 서버 (dev1~6)
	memo?: string | null // 마티가 적은 메모
	tc?: string | null // TC(Notion DB) URL — 있으면 E2E 버튼 활성
	devModel?: string | null // ▶진행 모델 override (간단한 작업은 sonnet/haiku)
	order?: number | null // 그룹 내 수동 순서
	taskClass?: 'dev' | 'ops' | 'unsure' | null // 코드/비개발 판정 (null=미판정)
	classReason?: string | null // 판정 근거
	classConfidence?: number | null // 0~1
	classPlan?: string | null // ops일 때 워크트리 없이 처리 방법
	classManual?: boolean // 마티가 모달로 확정했는지
	opsResult?: { summary: string; artifacts?: string[]; needsHuman?: boolean; ask?: string | null; at?: number } | null // 비개발 처리 결과
	opsRunning?: boolean // 비개발 처리 진행 중
	prReviews?: Record<string, PrReview> | null // 'repo#num' → 리뷰/개선 상태
}
interface PrReviewIssue {
	severity: 'P1' | 'P2' | 'P3'
	file: string | null
	line: number | null
	title: string
	detail: string
	fix: string
}
interface PrReview {
	reviewing?: boolean
	review?: { summary: string; verdict?: string; issues: PrReviewIssue[] } | null
	reviewedAt?: number
	improving?: boolean
	improved?: { summary: string; fixed: string[]; pushed: boolean; at: number } | null
	applying?: boolean // 📥 PR에 올라온 (남의) 리뷰 반영 진행 중
	applied?: { summary: string; applied: string[]; skipped: string[]; pushed: boolean; at: number; commented?: boolean } | null
	questioning?: boolean
	question?: { question: string; answer: string; verdictChanged: boolean; at: number } | null
}
// 📦 보관함 스냅샷 — 해결한 작업을 날짜별로 보존
interface ArchivedItem {
	key: string
	ticket: string | null
	title: string | null
	group?: string | null
	prs: { number: number; repo: string; url: string; title?: string | null; state?: string | null }[]
	archivedAt: number
}
interface ArchiveDay {
	date: string
	items: ArchivedItem[]
}
// ⚠️ 실패한 추출/백로그 잡 (입력 보존 → 재시도용)
interface JobFailure {
	id: string
	kind: string
	title: string
	error: string
	at: number
}
// 업무 코드/비개발 판정 배지 메타 (null=아직 분류 중)
const CLASS_META: Record<string, { icon: string; label: string; cls: string }> = {
	dev: { icon: '🧑‍💻', label: '개발', cls: 'dev' },
	ops: { icon: '📋', label: '비개발', cls: 'ops' },
	unsure: { icon: '❓', label: '판정 필요', cls: 'unsure' },
}
const LINK_ROWS: { kind: LinkKind; icon: string; label: string }[] = [
	{ kind: 'slack', icon: '🧵', label: '스레드' },
	{ kind: 'notion', icon: '📄', label: '노션' },
	{ kind: 'figma', icon: '🎨', label: '피그마' },
]
// 리뷰어(마티) 설득 + DX 지시 — MRM 에이전트가 코드만 던지지 않고 리뷰가 쉬운 브리핑으로 마무리하게.
export const REVIEW_DIRECTIVE = `[리뷰 방식] 마티가 이 변경을 직접 리뷰해. 코드만 넘기지 말고 리뷰어를 '설득'하는 브리핑으로 마무리해줘 — 특히 DX(리뷰 경험)를 최우선으로: ① 무엇을·왜(각 결정의 근거를 먼저 밝혀 내가 의도를 역추적 안 하게) ② 고려했다 기각한 대안과 이유 ③ 먼저 봐야 할 파일:라인을 우선순위/읽는 순서까지 콕 집기 ④ 리스크·사이드이펙트·엣지케이스·하위호환 우려를 먼저 자백 ⑤ 실제로 한 검증(빌드/타입/테스트/수동)만, 안 한 건 안 했다고. 변경은 작고 목적이 분명한 단위로, 확신 없으면 단정 말고 근거와 함께.`

// 업무의 링크/제목을 Claude 초기 지시로 묶기 — 에이전트가 스레드·노션·피그마를 읽고 진행하게.
const buildSeed = (t: WorkItem, reviewMode = true) => {
	const refs: string[] = []
	for (const u of t.links.slack) refs.push(`Slack 스레드: ${u}`)
	for (const u of t.links.notion) refs.push(`Notion: ${u}`)
	for (const u of t.links.figma) refs.push(`Figma: ${u}`)
	const lines = [`이 업무를 진행해줘.`]
	if (t.ticket) lines.push(`티켓: ${t.ticket}`)
	if (t.title && t.title !== t.ticket) lines.push(`제목: ${t.title}`)
	if (refs.length) lines.push(`참고 링크 — ${refs.join(' / ')} (Slack/Notion/Figma MCP로 내용 먼저 확인)`)
	lines.push(`먼저 위 맥락과 관련 코드를 파악해서 무슨 작업인지 정리하고, 변경 계획부터 알려줘.`)
	if (reviewMode) lines.push(REVIEW_DIRECTIVE)
	return lines.join(' ')
}

// QA TC 양식 — 팀 TC 템플릿 예시를 '그대로 복제'해서 씀. 스키마 재해석·변경 절대 금지(마티 지침).
// 예시: https://app.notion.com/p/b185377f8a324bff985724ab3ab4987e (TC)
const TC_TEMPLATE_ID = 'b185377f8a324bff985724ab3ab4987e'
const TC_TEMPLATE = `[TC 양식 — 절대 재해석·컬럼 변경 금지. 반드시 팀 예시 DB를 '복제'해서 사용.]
방식: notion-create-database로 새로 만들지 마. notion-duplicate-page로 예시 DB(page_id ${TC_TEMPLATE_ID}, https://app.notion.com/p/${TC_TEMPLATE_ID})를 복제하고, 복제본을 지정 부모 아래로 옮긴 뒤(notion-move-pages) 제목만 "[티켓] [제목] — TC"로 바꿔라. 예시 샘플 행이 있으면 삭제. 컬럼(스키마)은 예시 그대로 — 추가/삭제/이름변경 절대 금지.
그 후 도출한 TC를 '행으로만' 채워(notion-create-pages, parent=복제본 data_source): Scenario (T/C Title)=TC 제목, Feature=기능 단위, 확인 플랫폼=[PC web/Mobile web], Given (사전조건)=세팅+진입 경로, When (테스트 단계)="1. … 2. … 3. …" 순서, 테스트 데이터=입력값, Then (기대결과)=시스템 반응. 결과·수정 플랫폼·QA확인자는 비워둠.`

// QA 테스트케이스 생성 지시 — 에이전트가 Figma·노션·PR diff·코드를 읽고 TC를 Notion DB(예시 스키마)로 만든다.
const buildQaSeed = (t: WorkItem, reviewMode = true, notionParent = '') => {
	const refs: string[] = []
	for (const u of t.links.slack) refs.push(`Slack: ${u}`)
	for (const u of t.links.notion) refs.push(`Notion: ${u}`)
	for (const u of t.links.figma) refs.push(`Figma: ${u}`)
	const prs = t.prs.map((p) => `${p.repo}#${p.number}`).join(', ')
	const slug = (t.ticket || t.key).toLowerCase()
	const title = `${t.ticket || ''} ${t.title || ''}`.trim()
	const lines = [
		`이 업무의 QA 테스트케이스(TC)를 만들어 Notion에 올려줘.`,
		t.ticket ? `티켓: ${t.ticket}.` : '',
		t.title ? `제목: ${t.title}.` : '',
		refs.length ? `참고 링크 — ${refs.join(' / ')} (Slack/Notion/Figma MCP로 먼저 정독).` : '',
		prs ? `구현 PR: ${prs} (gh pr diff 로 실제 변경을 확인).` : '',
		`진행: ① Figma·노션·PR diff·이 워크트리 코드를 읽어 기능/화면/정책 파악 ② 정상 플로우 + 엣지케이스(빈값·경계·에러·권한·중복·발송실패·PC/웹뷰 차이·반응형) 위주로 TC 도출.`,
		TC_TEMPLATE,
		notionParent
			? `산출물: 위 [TC 양식] 방식대로 예시 DB를 복제해 부모(${notionParent}) 하위에 "${title} — TC"로 만들고(스키마 재해석 금지) 도출한 TC를 행으로 채워줘. 다 만들면 DB URL을 알려주고, MRM에 등록해줘: curl -s -X POST http://localhost:8770/api/tasks/tc -H 'Content-Type: application/json' -d '{"ticket":"${
					t.ticket || t.key
			  }","url":"<완성한 DB URL>"}' (이러면 E2E 생성 버튼이 활성화됨).`
			: `산출물: (Notion 위치 미지정) _artifacts/${slug}-tc.html 로 저장하고 경로 알려줘.`,
		`백업으로 _artifacts/${slug}-tc.html 도 남겨줘(리뷰용).`,
	]
	if (reviewMode) lines.push(REVIEW_DIRECTIVE)
	return lines.filter(Boolean).join(' ')
}

// E2E 테스트 생성 지시 — 완성된 TC(Notion DB)를 읽어 playwright E2E로.
const buildE2eSeed = (t: WorkItem, reviewMode = true) => {
	const prs = t.prs.map((p) => `${p.repo}#${p.number}`).join(', ')
	const lines = [
		`이 업무의 완성된 TC를 바탕으로 E2E 테스트(playwright)를 만들어줘.`,
		t.ticket ? `티켓: ${t.ticket}.` : '',
		t.tc
			? `TC 문서(Notion DB): ${t.tc} — Notion MCP로 각 TC(Scenario/Given/When/Then/테스트 데이터)를 읽어와.`
			: '',
		prs ? `구현 PR: ${prs} (gh pr diff로 대상 셀렉터·라우트 확인).` : '',
		`진행: ① TC 각 케이스에서 자동화 가능한 것(결정적 UI 동작=클릭→토스트/모달/네비/값·disabled)만 선별 ② playwright E2E 코드로 작성(Given=진입·세팅, When=조작, Then=assert) ③ 자동화 어려운 것(시각 미세·실발송·웹뷰 네이티브)은 스킵/주석 + 사유 표기.`,
		`이 워크트리의 기존 E2E 컨벤션(playwright config·기존 spec)을 먼저 확인해 맞춰 작성. 실발송·파괴적 액션은 절대 자동 실행 금지.`,
	]
	if (reviewMode) lines.push(REVIEW_DIRECTIVE)
	return lines.filter(Boolean).join(' ')
}

// 그룹 내 PR 상태 4분류 — 카드를 대표 PR(가장 열린 것) 기준으로 나눔
// 완료 = PR이 하나 이상 있고 전부 머지됨 → 그룹에서 빼서 '✅ 완료' 섹션으로 수납
const isDone = (t: WorkItem): boolean =>
	Array.isArray(t.prs) && t.prs.length > 0 && t.prs.every((p) => p.state === 'MERGED')
const prBucket = (t: WorkItem): 'merged' | 'ready' | 'draft' | 'none' => {
	const p = (t.prs || [])[0] // build가 OPEN 먼저 정렬 → 첫 PR이 가장 열린 상태
	if (!p) return 'none'
	if (p.draft) return 'draft'
	if ((p.state || 'OPEN') === 'MERGED') return 'merged'
	return 'ready'
}
const PR_SECTIONS: { key: 'merged' | 'ready' | 'draft' | 'none'; label: string; dot: string }[] = [
	{ key: 'merged', label: '머지됨', dot: 'var(--green)' },
	{ key: 'ready', label: '리뷰 중', dot: 'var(--accent2)' },
	{ key: 'draft', label: '초안', dot: 'var(--yellow)' },
	{ key: 'none', label: 'PR 없음', dot: 'var(--muted)' },
]
// 배분된 모델 → 짧은 실시간 배지
const modelTag = (m?: string | null): string =>
	!m
		? ''
		: /opus/.test(m)
		? 'opus'
		: /sonnet/.test(m)
		? 'sonnet'
		: /haiku/.test(m)
		? 'haiku'
		: /fable/.test(m)
		? 'fable'
		: m.replace(/^claude-/, '')

export default function SessionsPage() {
	const navigate = useNavigate()
	const [cockpit, setCockpit] = useState<Cockpit | null>(null)
	const [cmux, setCmux] = useState<CmuxSession[]>([])
	const [showStreams, setShowStreams] = useState(true)
	// 리디자인: 포커스 스트림(떠 있는 워크스페이스 카드) — undefined면 첫 그룹 자동. 나머지 그룹은 접힌 행.
	// 여러 그룹을 독립적으로 열었다 닫음 (gid Set) — 영속화. 첫 로드는 아래 seed로 첫 그룹만 오픈.
	const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
		try {
			const s = localStorage.getItem('mrm-open-groups')
			if (s != null) return new Set<string>(JSON.parse(s))
		} catch (_) {}
		return new Set<string>()
	})
	const seededOpenRef = useRef(false)
	const toggleGroup = (gid: string) =>
		setOpenGroups((s) => {
			const n = new Set(s)
			if (n.has(gid)) n.delete(gid)
			else n.add(gid)
			return n
		})
	const [settingsGroup, setSettingsGroup] = useState<string | null>(null) // ⚙ 그룹 설정 열린 그룹
	// 리디자인: 밀도 토글(넉넉/조밀). documentElement에 클래스 → CSS로 카드 밀도 조절. 페이지 벗어나면 자동 해제.
	const [density, setDensity] = useState<'comfortable' | 'compact'>(() =>
		localStorage.getItem('mrm-density') === 'compact' ? 'compact' : 'comfortable'
	)
	const setDensityMode = (d: 'comfortable' | 'compact') => {
		setDensity(d)
		try {
			localStorage.setItem('mrm-density', d)
		} catch (_) {}
	}
	useEffect(() => {
		document.documentElement.classList.toggle('dev-compact', density === 'compact')
		return () => document.documentElement.classList.remove('dev-compact')
	}, [density])
	// 앰비언트 스트립 카운트/부하 — ResourceBar와 동일 소스(/api/resources)
	const [resources, setResources] = useState<{ claude: number; devServers: number; agents: number } | null>(null)
	useEffect(() => {
		const f = () =>
			fetch('/api/resources')
				.then((r) => r.json())
				.then(setResources)
				.catch(() => {})
		const t = setTimeout(f, 600)
		const id = setInterval(f, 15000)
		return () => {
			clearTimeout(t)
			clearInterval(id)
		}
	}, [])
	const heavy = !!resources && (resources.claude >= 6 || resources.devServers >= 5 || resources.agents >= 8)
	// 열린 그룹 영속화
	useEffect(() => {
		try {
			localStorage.setItem('mrm-open-groups', JSON.stringify([...openGroups]))
		} catch (_) {}
	}, [openGroups])
	const [terms, setTerms] = useState<TermSession[]>([])
	const [openTerms, setOpenTerms] = useState<Set<string>>(new Set())
	const [newCwd, setNewCwd] = useState('')
	const [newCmd, setNewCmd] = useState('claude')
	// ＋새 작업 런처 (티켓 → 워크트리 자동 생성 → claude + 초기 지시)
	const [taskTicket, setTaskTicket] = useState('')
	const [taskBase, setTaskBase] = useState('develop')
	const [taskSeed, setTaskSeed] = useState('')
	const [taskBusy, setTaskBusy] = useState(false)
	const [progressBusy, setProgressBusy] = useState<Set<string>>(new Set()) // ▶진행 누른 카드만 로딩 (전역 아님)
	const [backlogBusy, setBacklogBusy] = useState<Set<string>>(new Set()) // 백로그 생성 진행 중인 업무 key
	const [qaBusy, setQaBusy] = useState<Set<string>>(new Set()) // QA 에이전트 투입 진행 중인 업무 key
	const [e2eBusy, setE2eBusy] = useState<Set<string>>(new Set()) // E2E 에이전트 투입 진행 중인 업무 key
	const [qaNotionUrl, setQaNotionUrl] = useState(() => localStorage.getItem('mrm-qa-notion') || '') // TC를 만들 Notion 부모 (배포마다 바뀜)
	const [classModal, setClassModal] = useState<WorkItem | null>(null) // 코드/비개발 확정 모달 (열린 업무)
	const [classBusy, setClassBusy] = useState<Set<string>>(new Set()) // 재판정 진행 중인 업무 key
	// 그룹 오케스트레이터 — 콘솔 열림 그룹 + 그룹별 지휘자 활성 여부(헤더 배지)
	const [orchOpen, setOrchOpen] = useState<Set<string>>(new Set())
	const [orchAll, setOrchAll] = useState<Record<string, { active: boolean; model?: string | null }>>({})
	useEffect(() => {
		const load = () =>
			fetch('/api/orch/status')
				.then((r) => r.json())
				.then((d) => d.ok && setOrchAll(d.orchestrators || {}))
				.catch(() => {})
		load()
		const id = setInterval(load, 5000)
		return () => clearInterval(id)
	}, [])
	const toggleOrch = (g: string) =>
		setOrchOpen((s) => {
			const n = new Set(s)
			n.has(g) ? n.delete(g) : n.add(g)
			return n
		})
	const [restorables, setRestorables] = useState<
		{ name: string; cwd: string; label: string | null; kind: string; port: number | null; dirExists: boolean }[]
	>([]) // 재부팅 후 복원 가능 세션
	const [restoreBusy, setRestoreBusy] = useState(false)
	const [taskMsg, setTaskMsg] = useState<{ ok: boolean; text: string } | null>(null)
	const [launcherOpen, setLauncherOpen] = useState(false)
	// 포커스 모드 — 타일 하나를 전체폭으로
	const [focus, setFocus] = useState<string | null>(null)
	// 업무 보드
	const [tasks, setTasks] = useState<WorkItem[] | null>(null)
	const [notionMeta, setNotionMeta] = useState<Record<string, { t: string; b?: boolean }>>({}) // 노션 pageId → {제목, 백로그여부}
	const [newLink, setNewLink] = useState('')
	const [linkBusy, setLinkBusy] = useState(false)
	const [enrichBusy, setEnrichBusy] = useState(false)
	const [linkMsg, setLinkMsg] = useState<string | null>(null)
	const [failures, setFailures] = useState<JobFailure[]>([])
	const [failDockOpen, setFailDockOpen] = useState(true) // 오른쪽 실패 도크 열림/접힘
	// 📋 진행 현황 스티키 도크 — 진행중 라이브 + 완료 전환 확인
	const [progDockOpen, setProgDockOpen] = useState(true)
	const [justCompleted, setJustCompleted] = useState<{ key: string; title: string; at: number }[]>([]) // 진행중→완료 전환(확인 대기)
	const [justWaiting, setJustWaiting] = useState<{ key: string; title: string; at: number }[]>([]) // 진행중→질문 대기 전환(확인 대기)
	const prevInProgRef = useRef<Set<string>>(new Set())
	const prevWaitRef = useRef<Set<string>>(new Set())
	// 확인(ack) 처리한 업무는, 실제로 다시 '진행중(에이전트 작업중)'이 관측되기 전까지 같은 완료/질문대기로 재알림하지 않음.
	// (터미널 화면을 문자열로 스크레이프해 작업중/대기 판정하다 보니 순간적으로 깜빡여 같은 상태가 반복 감지될 수 있어서)
	const ackedDoneRef = useRef<Set<string>>(new Set())
	const ackedWaitRef = useRef<Set<string>>(new Set())
	const [highlightKey, setHighlightKey] = useState<string | null>(null) // 도크에서 클릭한 카드 강조
	const [addLinkFor, setAddLinkFor] = useState<string | null>(null)
	const [addLinkUrl, setAddLinkUrl] = useState('')
	// 카드 펼침 레벨 0(접힘)·1(요약)·2(전체) — 레벨별 필요 정보만
	const [taskLevel, setTaskLevel] = useState<Record<string, number>>(() => {
		try {
			return JSON.parse(localStorage.getItem('mrm-task-levels') || '{}')
		} catch {
			return {}
		}
	})
	const [deletingKeys, setDeletingKeys] = useState<Set<string>>(new Set())
	// 리뷰어 설득 브리핑 모드 (서버 설정) — 에이전트가 리뷰 브리핑으로 마무리할지
	const [reviewMode, setReviewMode] = useState(true)
	const [fableLock, setFableLock] = useState(false) // Fable 킬스위치 — 켜면 지휘·설계도 opus로(비용 차단)
	const [agentNotify, setAgentNotify] = useState(true) // 에이전트 완료/질문/인증 맥 알림
	const [cockpitOpen, setCockpitOpen] = useState(() => localStorage.getItem('mrm-cockpit-open') !== '0') // 요약 스트립 접기(업무 보드 집중)
	const toggleCockpit = () =>
		setCockpitOpen((v) => {
			localStorage.setItem('mrm-cockpit-open', v ? '0' : '1')
			return !v
		})
	useEffect(() => {
		fetch('/api/settings')
			.then((r) => r.json())
			.then((d) => {
				if (!d.ok) return
				setReviewMode(d.settings.reviewMode !== false)
				setFableLock(!!d.settings.fableLock)
				setAgentNotify(d.settings.agentNotify !== false)
			})
			.catch(() => {})
	}, [])
	const toggleReviewMode = () => {
		const next = !reviewMode
		setReviewMode(next)
		fetch('/api/settings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ reviewMode: next }),
		}).catch(() => {})
	}
	const toggleFableLock = () => {
		const next = !fableLock
		setFableLock(next)
		fetch('/api/settings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ fableLock: next }),
		}).catch(() => {})
	}
	const toggleAgentNotify = () => {
		const next = !agentNotify
		setAgentNotify(next)
		fetch('/api/settings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agentNotify: next }),
		}).catch(() => {})
	}
	// 원클릭 토글 (접힘 0 ↔ 펼침 1) — 더블클릭 없이 한 번에.
	const bumpLevel = (key: string) =>
		setTaskLevel((m) => {
			const n = { ...m }
			if (m[key]) delete n[key]
			else n[key] = 1
			try {
				localStorage.setItem('mrm-task-levels', JSON.stringify(n))
			} catch {
				/* noop */
			}
			return n
		})
	// 그룹핑 (드래그앤드롭으로 업무 묶기)
	const [taskGroups, setTaskGroups] = useState<string[]>([])
	// 첫 로드(영속값 없음)면 첫 그룹만 자동으로 열어둠 — 그 뒤엔 사용자가 자유롭게 개폐
	useEffect(() => {
		if (seededOpenRef.current) return
		if (localStorage.getItem('mrm-open-groups') != null) {
			seededOpenRef.current = true
			return
		}
		if (taskGroups.length) {
			setOpenGroups(new Set([taskGroups[0]]))
			seededOpenRef.current = true
		}
	}, [taskGroups])
	const [groupBases, setGroupBases] = useState<Record<string, string>>({}) // 그룹 → base 브랜치 (배포 타깃)
	const [chainedGroups, setChainedGroups] = useState<Record<string, boolean>>({}) // 그룹 → 체인 모드 (카드 순서대로 PR base 사슬)
	const [chainBusy, setChainBusy] = useState<string | null>(null) // 체인 적용 중인 그룹
	const [groupDevBusy, setGroupDevBusy] = useState<string | null>(null) // 그룹 브랜치 개발서버 켜는 중인 그룹
	const [branches, setBranches] = useState<string[]>([]) // 실제 브랜치 목록 (그룹 base select용)
	const dragTask = useRef<string | null>(null)
	const [dragOverGroup, setDragOverGroup] = useState<string | null>(null) // 그룹명 또는 '__none__'
	const [dragOverCard, setDragOverCard] = useState<string | null>(null) // 카드 위로 드래그 중 (삽입 위치 표시)
	const loadTasks = (force?: boolean) =>
		fetch('/api/tasks' + (force ? '?force=1' : ''))
			.then((r) => r.json())
			.then((d) => {
				if (d.ok) {
					setTasks(d.tasks)
					setTaskGroups(d.groups || [])
					setGroupBases(d.groupBases || {})
					setChainedGroups(d.chainedGroups || {})
					setNotionMeta(d.notionMeta || {})
				}
			})
			.catch(() => {})
	// 초기 보드 로드 — 타임아웃(6s)+재시도로 견고하게. 첫 fetch가 브라우저 연결한도에 밀리거나 실패해도
	// 스켈레톤이 20초 폴링까지 안 멈추고, 몇 초 안에 반드시 풀리도록.
	useEffect(() => {
		let alive = true
		let tries = 0
		let retryTimer: ReturnType<typeof setTimeout>
		const boot = () => {
			if (!alive) return
			const ctrl = new AbortController()
			const to = setTimeout(() => ctrl.abort(), 6000)
			fetch('/api/tasks', { signal: ctrl.signal })
				.then((r) => r.json())
				.then((d) => {
					clearTimeout(to)
					if (!alive) return
					if (d.ok) {
						setTasks(d.tasks)
						setTaskGroups(d.groups || [])
						setGroupBases(d.groupBases || {})
						setChainedGroups(d.chainedGroups || {})
						setNotionMeta(d.notionMeta || {})
					} else if (tries++ < 10) retryTimer = setTimeout(boot, 1200)
				})
				.catch(() => {
					clearTimeout(to)
					if (alive && tries++ < 10) retryTimer = setTimeout(boot, 1200)
				})
		}
		boot()
		loadRestorable()
		loadArchived()
		loadFailures()
		const idf = setInterval(loadFailures, 20000)
		const id = setInterval(() => loadTasks(), 20000)
		return () => {
			alive = false
			clearInterval(id)
			clearInterval(idf)
			clearTimeout(retryTimer)
		}
	}, [])
	// 직전 board 형태(그룹·카드 수)를 저장 → 다음 로딩 스켈레톤이 같은 개수로 그려져 레이아웃 시프트 최소화
	useEffect(() => {
		if (!tasks) return
		const shape = [...taskGroups, null]
			.map((g) => ({ named: g != null, count: tasks.filter((t) => (t.group || null) === g).length }))
			.filter((x) => x.named || x.count > 0)
		try {
			localStorage.setItem('mrm-board-shape', JSON.stringify(shape))
		} catch {
			/* noop */
		}
	}, [tasks, taskGroups])
	const loadRestorable = () =>
		fetch('/api/sessions/restorable')
			.then((r) => r.json())
			.then((d) => d.ok && setRestorables(d.sessions || []))
			.catch(() => {})
	const restoreSessions = (body: { kind?: string; all?: boolean; name?: string }) => {
		setRestoreBusy(true)
		tpost('/api/sessions/restore', body)
			.then((d: { results?: { ok?: boolean; error?: string }[] }) => {
				const ok = (d.results || []).filter((r) => r.ok).length
				const fail = (d.results || []).filter((r) => !r.ok).length
				setTaskMsg({ ok: fail === 0, text: `세션 복원: ${ok}개 성공${fail ? `, ${fail}개 실패` : ''}` })
			})
			.finally(() => {
				loadRestorable()
				loadTerms()
				loadTasks(true)
				setRestoreBusy(false)
			})
	}
	const forgetRestorable = (body: { name?: string; all?: boolean }) =>
		tpost('/api/sessions/forget', body).finally(() => loadRestorable())
	// 잡(일감/백로그) 완료 감지 → 보드 즉시 새로고침
	const prevJobsRef = useRef(0)
	useEffect(() => {
		let alive = true
		let timer: ReturnType<typeof setTimeout>
		const tick = () =>
			fetch('/api/tasks/jobs')
				.then((r) => r.json())
				.then((d: { active?: { kind?: string }[] }) => {
					if (!alive) return
					const n = (d.active || []).length
					if (n < prevJobsRef.current) loadTasks(true)
					prevJobsRef.current = n
					if (!(d.active || []).some((j) => j.kind === 'backlog'))
						setBacklogBusy((s) => (s.size ? new Set() : s))
					timer = setTimeout(tick, n ? 1500 : 5000)
				})
				.catch(() => {
					if (alive) timer = setTimeout(tick, 5000)
				})
		timer = setTimeout(tick, 500) // 첫 호출 지연 — 보드 먼저
		return () => {
			alive = false
			clearTimeout(timer)
		}
	}, [])
	const tpost = (url: string, body: unknown) =>
		fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}).then((r) => r.json())
	// 여러 줄이면 한 줄당 1개씩 순차 생성(경합 방지). 링크 없는 줄은 텍스트 일감.
	const createTask = async () => {
		const lines = newLink
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean)
		if (!lines.length) return
		setLinkBusy(true)
		setLinkMsg(null)
		let ok = 0
		const fails: string[] = []
		for (const line of lines) {
			try {
				const r = await tpost('/api/tasks/create', { url: line })
				if (r.ok) ok++
				else fails.push(r.error || '실패')
			} catch (e) {
				fails.push(String(e))
			}
		}
		if (ok) setNewLink('')
		setLinkMsg(
			`${ok > 0 ? '✅' : '⚠️'} ${ok}/${lines.length}개 업무 생성${fails.length ? ` · 실패 ${fails.length}` : ''}`
		)
		loadTasks(true)
		setLinkBusy(false)
	}
	// ✨ 일감 생성 — 스레드/노션/피그마 링크를 AI가 읽어 제목·요약·관련 링크까지 채운 일감 생성.
	// 잡만 시작하고 진행률은 전역 JobBar가 표시(페이지 이동에도 유지).
	const enrichLink = () => {
		const url = newLink.trim()
		if (!url) {
			setLinkMsg('링크를 넣어주세요 (스레드·노션·피그마).')
			return
		}
		setEnrichBusy(true)
		setLinkMsg(null)
		tpost('/api/tasks/enrich/start', { url })
			.then((r: { ok?: boolean; jobId?: string; error?: string }) => {
				if (r.ok && r.jobId) {
					setNewLink('')
					setLinkMsg(
						'✨ 일감 생성 시작 — 상단 진행바에서 진행률을 확인하세요. 완료되면 자동으로 보드에 추가됩니다.'
					)
				} else setLinkMsg('⚠️ ' + (r.error || '시작 실패'))
			})
			.catch((e) => setLinkMsg('⚠️ ' + String(e)))
			.finally(() => setEnrichBusy(false))
	}
	// ⚠️ 실패한 추출/백로그 — 입력 보존 → 재입력 없이 재시도
	const loadFailures = () =>
		fetch('/api/tasks/failures')
			.then((r) => r.json())
			.then((d: { failures?: JobFailure[] }) => setFailures(d.failures || []))
			.catch(() => {})
	const retryFailure = (id: string) => {
		tpost('/api/tasks/failures/retry', { id }).then((r: { ok?: boolean; error?: string }) => {
			if (!r.ok) {
				setLinkMsg('⚠️ 재시도 실패: ' + (r.error || '?'))
				return
			}
			setLinkMsg('🔄 재시도 시작 — 상단 진행바에서 진행률을 확인하세요.')
			loadFailures()
			;[8000, 30000, 60000].forEach((ms) =>
				setTimeout(() => {
					loadFailures()
					loadTasks(true)
				}, ms)
			)
		})
	}
	const dismissFailure = (id: string) => tpost('/api/tasks/failures/dismiss', { id }).then(loadFailures)
	const addLink = (key: string, url: string) => {
		if (!url.trim()) return
		tpost('/api/tasks/link', { ticket: key, url: url.trim(), action: 'add' }).then(() => {
			setAddLinkFor(null)
			setAddLinkUrl('')
			loadTasks(true)
		})
	}
	const removeLink = (key: string, kind: LinkKind, url: string) =>
		tpost('/api/tasks/link', { ticket: key, url, kind, action: 'remove' }).then(() => loadTasks(true))
	const removeWorkItem = (t: WorkItem) => {
		const wts = t.streams.filter((s) => !s.isMain)
		const openPrs = t.prs.filter((p) => p.state === 'OPEN')
		const myPrs = openPrs.filter((p) => p.mine !== false) // 자동 PR=내것, 수동으로 붙인 남의 PR만 mine=false
		const otherPrs = openPrs.filter((p) => p.mine === false)
		const lines = [`업무 삭제: ${t.ticket || t.key}`]
		if (wts.length) lines.push(`• 워크트리 삭제(미커밋 변경 폐기): ${wts.map((s) => s.name).join(', ')}`)
		if (myPrs.length) lines.push(`• 내 PR 닫기: ${myPrs.map((p) => `${p.repo}#${p.number}`).join(', ')}`)
		if (otherPrs.length)
			lines.push(
				`• ⚠️ 남의 PR은 닫지 않고 보존: ${otherPrs
					.map((p) => `${p.repo}#${p.number}${p.author ? '(@' + p.author + ')' : ''}`)
					.join(', ')}`
			)
		if (!wts.length && !myPrs.length) lines.push('(등록한 링크/분류만 제거 — 워크트리·내 PR 없음)')
		else lines.push('되돌릴 수 없습니다.')
		if (!confirm(lines.join('\n'))) return
		setDeletingKeys((s) => new Set(s).add(t.key))
		tpost('/api/tasks/remove', { key: t.key, deleteWork: wts.length > 0 || myPrs.length > 0 })
			.then((r: { errors?: string[] }) => {
				if (r.errors && r.errors.length) alert('일부 실패:\n' + r.errors.join('\n'))
				setTasks((prev) => (prev ? prev.filter((x) => x.key !== t.key) : prev)) // 즉시 제거
				loadTasks() // 캐시 패치됨 → 즉시
			})
			.catch((e) => alert('삭제 실패: ' + String(e)))
			.finally(() =>
				setDeletingKeys((s) => {
					const n = new Set(s)
					n.delete(t.key)
					return n
				})
			)
	}
	const editTitle = (key: string, cur: string) => {
		const v = prompt('업무 제목', cur)
		if (v == null) return
		tpost('/api/tasks/title', { ticket: key, title: v }).then(() => loadTasks(true))
	}
	// 그룹: 배정(드래그앤드롭) — 낙관적 반영 + 백그라운드 저장. 그룹 base가 있으면 서버가 열린 PR을 재타깃(L1) → 결과 토스트.
	const setGroupOf = (key: string, group: string | null) => {
		setTasks((prev) => (prev ? prev.map((t) => (t.key === key ? { ...t, group: group || null } : t)) : prev))
		if (group) setTaskGroups((g) => (g.includes(group) ? g : [...g, group]))
		tpost('/api/tasks/group', { key, group })
			.then(
				(r: {
					base?: string
					retarget?: {
						done?: { number: number; base: string; already?: boolean }[]
						failed?: { number: number; error: string }[]
					}
				}) => {
					const rt = r && r.retarget
					if (!rt) return
					const moved = (rt.done || []).filter((d) => !d.already)
					if (moved.length)
						setTaskMsg({
							ok: true,
							text: `🌿 PR ${moved.map((d) => '#' + d.number).join(', ')} base → ${
								r.base
							} (되돌리려면 원래 그룹으로)`,
						})
					if (rt.failed && rt.failed.length)
						setTaskMsg({
							ok: false,
							text: `⚠️ PR #${rt.failed[0].number} 재타깃 실패: ${rt.failed[0].error}`,
						})
				}
			)
			.catch(() => loadTasks(true))
	}
	// 그룹 내 '완료' 하위 섹션 압축 — 기본 접힘 (완료 카드는 각 그룹 안에 위치, 전역 혼합 X)
	const [doneOpenGroups, setDoneOpenGroups] = useState<Set<string>>(new Set())
	const toggleDoneGroup = (gid: string) =>
		setDoneOpenGroups((set) => {
			const nx = new Set(set)
			nx.has(gid) ? nx.delete(gid) : nx.add(gid)
			return nx
		})
	// 그룹 내 '머지됨' 섹션 압축 — 기본 접힘(gid가 set에 있으면 펼침)
	const [mergedOpen, setMergedOpen] = useState<Set<string>>(new Set())
	const toggleMerged = (gid: string) =>
		setMergedOpen((s) => {
			const n = new Set(s)
			n.has(gid) ? n.delete(gid) : n.add(gid)
			return n
		})
	const [cleanupBusy, setCleanupBusy] = useState<string | null>(null)
	const runCleanupDone = (num: number, group?: string | null, gid?: string) => {
		if (
			!confirm(
				`${
					group != null ? `'${group}' ` : ''
				}완료된 ${num}건을 정리합니다.\n\n워크트리·로컬 브랜치·등록을 삭제합니다. (PR은 이미 머지됨)`
			)
		)
			return
		setCleanupBusy(gid || '__all__')
		setTaskMsg({ ok: true, text: `🧹 완료 ${num}건 정리 중…` })
		tpost('/api/tasks/cleanup-done', group !== undefined ? { group } : {})
			.then((d: { ok?: boolean; count?: number; errors?: string[] }) => {
				if (d.ok)
					setTaskMsg({
						ok: !d.errors?.length,
						text: `✅ ${d.count}건 정리 완료${d.errors?.length ? ` · ${d.errors.length}건 실패` : ''}`,
					})
			})
			.catch(() => {})
			.finally(() => {
				setCleanupBusy(null)
				loadTasks(true)
			})
	}
	// 📦 작업 보관함 — 해결한 작업을 날짜별 이력으로 보존(삭제와 별개). 워크트리만 정리하고 스냅샷을 남긴다.
	const [archived, setArchived] = useState<ArchiveDay[]>([])
	const [archivedOpen, setArchivedOpen] = useState(false)
	const loadArchived = () =>
		fetch('/api/tasks/archived')
			.then((r) => r.json())
			.then((d: { archived?: ArchiveDay[] }) => setArchived(d.archived || []))
			.catch(() => {})
	const archiveTask = (t: WorkItem) => {
		const wts = t.streams.filter((s) => !s.isMain)
		const lines = [`📦 보관: ${t.ticket || t.title || t.key}`, '해결 이력(오늘 날짜)으로 보관함에 저장됩니다.']
		if (wts.length) lines.push(`• 워크트리 정리(미커밋 변경 폐기): ${wts.map((s) => s.name).join(', ')}`)
		lines.push('• PR·기록은 보존 (삭제와 다름). 보관함에서 복원 가능.')
		if (!confirm(lines.join('\n'))) return
		setDeletingKeys((s) => new Set(s).add(t.key))
		tpost('/api/tasks/archive', { key: t.key })
			.then((r: { ok?: boolean; errors?: string[]; error?: string }) => {
				if (r.errors && r.errors.length) alert('일부 실패:\n' + r.errors.join('\n'))
				else if (!r.ok) {
					alert('보관 실패: ' + (r.error || '?'))
					return
				}
				setTasks((prev) => (prev ? prev.filter((x) => x.key !== t.key) : prev))
				loadTasks()
				loadArchived()
				setArchivedOpen(true)
			})
			.catch((e) => alert('보관 실패: ' + String(e)))
			.finally(() =>
				setDeletingKeys((s) => {
					const n = new Set(s)
					n.delete(t.key)
					return n
				})
			)
	}
	const unarchiveTask = (key: string) =>
		tpost('/api/tasks/unarchive', { key }).then(() => {
			loadArchived()
			loadTasks(true)
		})
	const removeArchived = (key: string) => {
		if (!confirm('이 보관 항목을 영구 삭제할까요? (이력에서 제거)')) return
		tpost('/api/tasks/archived/remove', { key }).then(() => loadArchived())
	}
	// 🔎 PR 리뷰 → 🔧 개선 (1클릭 리뷰, 2클릭 리뷰대로 개선)
	// 리뷰 결과는 모달로 바로 보여준다(내가 돌린 리뷰가 끝나면 자동 오픈 + 칩 클릭으로 열기).
	const [reviewModal, setReviewModal] = useState<{
		prKey: string
		prNum: number
		title: string
		review: NonNullable<PrReview['review']>
		improved?: PrReview['improved']
		question?: PrReview['question']
	} | null>(null)
	// 🗣️ 리뷰 항의/질문 — 리뷰 판정에 반박·질문을 텍스트로 던지는 모달
	const [questionModal, setQuestionModal] = useState<{
		key: string
		repo: string
		prNum: number
		title: string
	} | null>(null)
	const [questionText, setQuestionText] = useState('')
	const reviewWantRef = useRef<Set<string>>(new Set()) // 내가 리뷰 돌린 prKey — 완료 시 모달 자동 오픈
	const seenReviewRef = useRef<Record<string, number>>({}) // prKey → 마지막 본 reviewedAt (신규 완료 감지)
	const reviewSeededRef = useRef(false) // 첫 로드는 토스트/모달 없이 seed만
	// 리뷰/개선은 헤드리스 잡(상단 진행바) → 결과는 잠시 후 보드에 반영. 몇 차례 새로고침으로 결과를 당겨온다.
	const refreshSoon = () => [8000, 20000, 45000, 90000].forEach((ms) => setTimeout(() => loadTasks(true), ms))
	const reviewPr = (t: WorkItem, pr: WorkItem['prs'][number]) => {
		const prKey = `${pr.repo}#${pr.number}`
		tpost('/api/tasks/pr-review', { key: t.key, repo: pr.repo, number: pr.number })
			.then((r: { ok?: boolean; error?: string }) => {
				if (!r.ok) {
					alert('리뷰 시작 실패: ' + (r.error || '?'))
					return
				}
				setTaskMsg({ ok: true, text: `🔎 PR #${pr.number} 리뷰 시작 — 완료되면 결과 창이 바로 뜹니다` })
				reviewWantRef.current.add(prKey) // 완료 시 리뷰 결과 모달 자동 오픈
				loadTasks(true)
				refreshSoon()
			})
			.catch((e) => alert('리뷰 실패: ' + String(e)))
	}
	const improvePr = (t: WorkItem, pr: WorkItem['prs'][number], review: PrReview['review']) => {
		const n = review?.issues?.length || 0
		if (
			!confirm(
				`🔧 리뷰대로 개선: ${pr.repo} #${pr.number}\n리뷰 이슈 ${n}건을 코드에 반영하고 브랜치(${
					pr.branch || '?'
				})에 커밋·푸시합니다.\n내 PR에만 동작 · 진행할까요?`
			)
		)
			return
		tpost('/api/tasks/pr-improve', { key: t.key, repo: pr.repo, number: pr.number })
			.then((r: { ok?: boolean; error?: string }) => {
				if (!r.ok) {
					alert('개선 시작 실패: ' + (r.error || '?'))
					return
				}
				setTaskMsg({ ok: true, text: `🔧 PR #${pr.number} 개선 시작 — 커밋·푸시까지 진행` })
				loadTasks(true)
				refreshSoon()
			})
			.catch((e) => alert('개선 실패: ' + String(e)))
	}
	// 📥 PR에 올라온 (남의) 리뷰 반영 — GitHub 리뷰·라인 코멘트를 가져와 코드에 반영·커밋·푸시 (내 PR만)
	const applyReviewPr = (t: WorkItem, pr: WorkItem['prs'][number]) => {
		if (
			!confirm(
				`📥 PR 리뷰 확인: ${pr.repo} #${pr.number}\n리뷰어(사람·봇)가 남긴 리뷰·라인 코멘트를 코드에 반영하고 브랜치(${
					pr.branch || '?'
				})에 커밋·푸시한 뒤, 항목별 답글을 GitHub에 자동 게시합니다.\n(내 PR만) 진행할까요?`
			)
		)
			return
		tpost('/api/tasks/pr-apply-review', { key: t.key, repo: pr.repo, number: pr.number })
			.then((r: { ok?: boolean; error?: string; count?: number }) => {
				if (!r.ok) {
					alert('PR 리뷰 확인 시작 실패: ' + (r.error || '?'))
					return
				}
				setTaskMsg({ ok: true, text: `📥 PR #${pr.number} 리뷰 확인 ${r.count || ''}건 시작 — 반영·커밋·푸시·답글까지 진행` })
				loadTasks(true)
				refreshSoon()
			})
			.catch((e) => alert('PR 리뷰 확인 실패: ' + String(e)))
	}
	// 🗣️ 리뷰 판정에 이의/질문 — 모달에서 받은 텍스트를 헤드리스 claude에 던져 근거 재확인 답변을 받는다.
	const askPrQuestion = () => {
		if (!questionModal || !questionText.trim()) return
		const { key, repo, prNum } = questionModal
		tpost('/api/tasks/pr-question', { key, repo, number: prNum, question: questionText.trim() })
			.then((r: { ok?: boolean; error?: string }) => {
				if (!r.ok) {
					alert('리뷰 항의 실패: ' + (r.error || '?'))
					return
				}
				setTaskMsg({
					ok: true,
					text: `🗣️ PR #${prNum} 리뷰 항의 접수 — 답변 준비되면 리뷰 결과 창에 표시됩니다`,
				})
				setQuestionModal(null)
				setQuestionText('')
				loadTasks(true)
				refreshSoon()
			})
			.catch((e) => alert('리뷰 항의 실패: ' + String(e)))
	}
	// 리뷰/개선 완료 감지 → 토스트 + (내가 돌린 리뷰면) 결과 모달 자동 오픈
	useEffect(() => {
		if (!tasks) return
		const seen = seenReviewRef.current
		const firstPass = !reviewSeededRef.current
		for (const t of tasks) {
			if (!t.prReviews) continue
			for (const [prKey, rv] of Object.entries(t.prReviews)) {
				if (rv.review && rv.reviewedAt && rv.reviewedAt > (seen[prKey] || 0)) {
					seen[prKey] = rv.reviewedAt
					if (!firstPass) {
						const v = rv.review.verdict
						const vlabel =
							v === 'approve' ? '✅ 통과' : v === 'request_changes' ? '⚠️ 변경요청' : '💬 코멘트'
						setTaskMsg({
							ok: v !== 'request_changes',
							text: `🔎 ${prKey} 리뷰 완료 · ${vlabel} · 이슈 ${rv.review.issues.length}건`,
						})
						if (reviewWantRef.current.has(prKey)) {
							reviewWantRef.current.delete(prKey)
							setReviewModal({
								prKey,
								prNum: Number(prKey.split('#')[1]) || 0,
								title: t.title,
								review: rv.review!,
								improved: rv.improved || null,
							})
						}
					}
				}
				const impAt = rv.improved?.at
				if (impAt && impAt > (seen[prKey + ':imp'] || 0)) {
					seen[prKey + ':imp'] = impAt
					if (!firstPass)
						setTaskMsg({
							ok: true,
							text: `🔧 ${prKey} 개선 완료${rv.improved?.pushed ? ' · 푸시됨' : ''} — ${(
								rv.improved?.summary || ''
							).slice(0, 50)}`,
						})
				}
				const aprAt = rv.applied?.at
				if (aprAt && aprAt > (seen[prKey + ':apr'] || 0)) {
					seen[prKey + ':apr'] = aprAt
					if (!firstPass)
						setTaskMsg({
							ok: true,
							text: `📥 ${prKey} 리뷰 확인${rv.applied?.pushed ? ' · 푸시됨' : ' (변경 없음)'} — ${(
								rv.applied?.summary || ''
							).slice(0, 50)}`,
						})
				}
				const qAt = rv.question?.at
				if (qAt && qAt > (seen[prKey + ':qst'] || 0)) {
					seen[prKey + ':qst'] = qAt
					if (!firstPass)
						setTaskMsg({
							ok: true,
							text: `🗣️ ${prKey} 리뷰 항의 답변 도착${
								rv.question?.verdictChanged ? ' · 판정 변경됨' : ''
							} — 리뷰 결과 창에서 확인하세요`,
						})
				}
			}
		}
		reviewSeededRef.current = true
	}, [tasks])
	// 그룹 base 브랜치 지정/해제 (배포 타깃)
	const [editBase, setEditBase] = useState<{ g: string; v: string } | null>(null)
	const saveGroupBase = (g: string, v: string) => {
		setEditBase(null)
		const base = String(v || '').trim()
		if (base === (groupBases[g] || '')) return
		setGroupBases((prev) => {
			const n = { ...prev }
			if (base) n[g] = base
			else delete n[g]
			return n
		}) // 낙관적
		tpost('/api/tasks/group-base', { group: g, baseBranch: base })
			.then((d: { ok?: boolean; error?: string }) => {
				if (d.ok)
					setTaskMsg({
						ok: true,
						text: base
							? `🌿 '${g}' 배포 base → ${base} (이 그룹에 넣는 작업 PR이 이 브랜치로 타깃)`
							: `🌿 '${g}' base 해제`,
					})
				else {
					setTaskMsg({ ok: false, text: 'base 저장 실패: ' + (d.error || '?') })
					loadTasks(true)
				}
			})
			.catch(() => loadTasks(true))
	}
	// 🔗 체인 on/off — 켜면 카드 순서대로 각 PR base를 앞 카드 브랜치로 재타깃 (첫 카드는 그룹 base/develop)
	const toggleChain = (g: string) => {
		const on = !chainedGroups[g]
		setChainBusy(g)
		setChainedGroups((c) => ({ ...c, [g]: on }))
		tpost('/api/tasks/chain', { group: g, on })
			.then(
				(r: {
					ok?: boolean
					chainedCount?: number
					results?: { failed?: { number: number; error: string }[] }[]
					error?: string
				}) => {
					if (!r.ok) {
						setChainedGroups((c) => ({ ...c, [g]: !on }))
						setTaskMsg({ ok: false, text: '체인 실패: ' + (r.error || '?') })
						return
					}
					if (on) {
						const failed = (r.results || []).flatMap((x) => x.failed || [])
						setTaskMsg({
							ok: failed.length === 0,
							text: failed.length
								? `🔗 체인 적용(일부 실패 ${failed.length}): ${failed
										.map((f) => `#${f.number} ${f.error}`)
										.join('; ')}`
								: `🔗 '${g}' 체인 — ${r.chainedCount || 0}개 카드 PR base를 순서대로 연결`,
						})
					} else
						setTaskMsg({
							ok: true,
							text: `🔗 '${g}' 체인 해제 (기존 PR base는 유지 — 필요 시 그룹 base로 되돌리세요)`,
						})
					loadTasks(true)
				}
			)
			.catch((e) => {
				setChainedGroups((c) => ({ ...c, [g]: !on }))
				setTaskMsg({ ok: false, text: '체인 오류: ' + String(e) })
			})
			.finally(() => setChainBusy(null))
	}
	// 🌿 그룹 브랜치 개발서버 — 그룹 멤버 브랜치를 전용 워크트리에 병합한 "그룹 브랜치" 위에서 dev 서버 켜기(이미 떠있으면 재사용) + 디버깅으로 이동
	const startGroupDev = (g: string) => {
		setGroupDevBusy(g)
		setTaskMsg({ ok: true, text: `🌿 '${g}' 그룹 브랜치 병합 중…` })
		tpost('/api/tasks/group/dev-server', { group: g })
			.then(
				(d: {
					ok?: boolean
					port?: number
					name?: string
					branch?: string
					reused?: boolean
					merged?: { ticket?: string | null; key: string }[]
					skipped?: { ticket?: string | null; key: string; reason: string }[]
					conflicts?: { ticket?: string | null; key: string; error: string }[]
					error?: string
				}) => {
					if (!d.ok) {
						setTaskMsg({ ok: false, text: `그룹 개발서버 실패: ${d.error || '?'}` })
						return
					}
					if (d.name) setOpenTerms((o) => new Set(o).add(d.name!))
					loadTerms()
					const label = (x?: { ticket?: string | null; key: string }) => x?.ticket || x?.key
					const parts = [
						`✅ '${g}' (${d.branch}) :${d.port}${d.reused ? ' 재사용' : ''} — 병합 ${
							d.merged?.length || 0
						}건`,
					]
					if (d.skipped?.length) parts.push(`스킵 ${d.skipped.length}(${d.skipped.map(label).join(',')})`)
					if (d.conflicts?.length)
						parts.push(
							`⚠️ 충돌 ${d.conflicts.length}(${d.conflicts
								.map(label)
								.join(',')}) — 해당 멤버는 그룹 브랜치에 반영 안 됨`
						)
					setTaskMsg({ ok: !d.conflicts?.length, text: parts.join(' · ') })
					if (d.port) navigate(`/command?port=${d.port}`)
				}
			)
			.catch((e) => setTaskMsg({ ok: false, text: '그룹 개발서버 오류: ' + String(e) }))
			.finally(() => setGroupDevBusy(null))
	}
	const loadBranches = () => {
		fetch('/api/branches')
			.then((r) => r.json())
			.then((d) => {
				if (d.ok) setBranches(d.branches || [])
			})
			.catch(() => {})
	}
	// 새 base 브랜치 생성 (develop 분기 + origin push) → 그 그룹 base로 지정
	const createBranchFor = (g: string) => {
		const name = prompt(`'${g}' 그룹의 새 base 브랜치 이름 (develop에서 분기 + origin에 생성):`, 'deploy-')
		if (!name || !name.trim()) return
		const nm = name.trim()
		setTaskMsg({ ok: true, text: `🌿 '${nm}' 생성 중 (develop 분기 + origin push)…` })
		tpost('/api/branches/create', { name: nm, base: 'develop' })
			.then((d: { ok?: boolean; name?: string; warn?: string; error?: string }) => {
				if (d.ok && d.name) {
					setBranches((prev) => (prev.includes(d.name!) ? prev : [d.name!, ...prev]))
					saveGroupBase(g, d.name)
					if (d.warn) setTaskMsg({ ok: false, text: '⚠️ ' + d.warn })
				} else setTaskMsg({ ok: false, text: '브랜치 생성 실패: ' + (d.error || '?') })
			})
			.catch(() => {})
	}
	// 배포 dev 서버(dev1~6) 지정 — 마티가 카드에서 직접. 낙관적 반영 + 백그라운드 저장.
	const setDevServerOf = (key: string, devServer: string | null) => {
		setTasks((prev) =>
			prev ? prev.map((t) => (t.key === key ? { ...t, devServer: devServer || null } : t)) : prev
		)
		tpost('/api/tasks/devserver', { key, devServer }).catch(() => loadTasks(true))
	}
	// 메모 저장 — blur 시. 낙관적 반영 + 백그라운드 저장.
	const setMemoOf = (key: string, memo: string) => {
		setTasks((prev) => (prev ? prev.map((t) => (t.key === key ? { ...t, memo: memo.trim() || null } : t)) : prev))
		tpost('/api/tasks/memo', { key, memo }).catch(() => loadTasks(true))
	}
	// 노션 링크 라벨 — pageId로 조회 → 백로그면 "📋 백로그", 아니면 제목(앞 이모지 제거·축약), 없으면 "노션 카드"
	const notionLabel = (u: string): string => {
		const m = u.match(/[0-9a-f]{32}/gi)
		const meta = m ? notionMeta[m[m.length - 1].toLowerCase()] : null
		if (!meta) return '노션 카드'
		if (meta.b) return '📋 백로그'
		const t = meta.t.replace(/^[^\w가-힣(]+/, '').trim() // 앞 상태 이모지 제거
		return t.length > 24 ? t.slice(0, 24) + '…' : t
	}
	// ▶진행 모델 override — 간단한 작업은 opus 대신 sonnet/haiku. 빈값=정책 기본(opus).
	const setTaskModelOf = (key: string, model: string | null) => {
		setTasks((prev) => (prev ? prev.map((t) => (t.key === key ? { ...t, devModel: model || null } : t)) : prev))
		tpost('/api/tasks/model', { key, model }).catch(() => loadTasks(true))
	}
	// 코드/비개발 확정 — 모달에서 마티가 [개발]/[비개발] 선택. 낙관적 반영 + 저장.
	const setClassOf = (key: string, cls: 'dev' | 'ops') => {
		setTasks((prev) =>
			prev
				? prev.map((t) => (t.key === key ? { ...t, taskClass: cls, classManual: true, classConfidence: 1 } : t))
				: prev
		)
		setClassModal(null)
		tpost('/api/tasks/class', { key, class: cls }).catch(() => loadTasks(true))
	}
	// 재판정 — AI에게 다시 분류 요청(백그라운드 잡). 완료되면 보드 새로고침으로 배지 갱신.
	const reclassify = (key: string) => {
		setClassBusy((s) => new Set(s).add(key))
		tpost('/api/tasks/classify/start', { key })
			.then(() =>
				setTimeout(() => {
					loadTasks(true)
					setClassBusy((s) => {
						const n = new Set(s)
						n.delete(key)
						return n
					})
				}, 6000)
			)
			.catch(() =>
				setClassBusy((s) => {
					const n = new Set(s)
					n.delete(key)
					return n
				})
			)
	}
	// 비개발 처리 시작 — 워크트리·PR 없이 ops 에이전트 투입(노션 정리 등). 진행은 상단 진행바, 완료 시 카드에 결과.
	const startOpsOf = (key: string) => {
		setTasks((prev) => (prev ? prev.map((t) => (t.key === key ? { ...t, opsRunning: true } : t)) : prev))
		setClassModal(null)
		tpost('/api/tasks/ops/start', { key }).catch(() => loadTasks(true))
	}
	const addGroup = () => {
		const n = prompt('새 그룹 이름 (관련 업무를 묶을 분류)')
		if (!n || !n.trim()) return
		const name = n.trim()
		setTaskGroups((g) => (g.includes(name) ? g : [...g, name]))
		tpost('/api/tasks/group/create', { name }).catch(() => loadTasks(true))
	}
	const delGroup = (name: string) => {
		if (!confirm(`그룹 '${name}' 삭제? (안의 업무는 미분류로 이동, 업무 자체는 유지)`)) return
		setTaskGroups((g) => g.filter((x) => x !== name))
		setTasks((prev) => (prev ? prev.map((t) => (t.group === name ? { ...t, group: null } : t)) : prev))
		setOpenGroups((s) => {
			const n = new Set(s)
			n.delete(name)
			return n
		}) // 삭제된 그룹 열림 목록에서 제거
		setSettingsGroup(null)
		tpost('/api/tasks/group/remove', { name }).catch(() => loadTasks(true))
	}
	// 그룹명 변경 — 모든 소속 업무 + 그룹 목록/base/체인/열림상태의 키를 새 이름으로
	const [renameGroup, setRenameGroup] = useState<{ old: string; v: string } | null>(null)
	const saveRename = (oldName: string, newName: string) => {
		const nn = newName.trim()
		setRenameGroup(null)
		if (!nn || nn === oldName) return
		if (taskGroups.includes(nn)) {
			alert(`이미 있는 그룹명: ${nn}`)
			return
		}
		setTaskGroups((g) => g.map((x) => (x === oldName ? nn : x)))
		setTasks((prev) => (prev ? prev.map((t) => (t.group === oldName ? { ...t, group: nn } : t)) : prev))
		setGroupBases((b) => {
			if (!(oldName in b)) return b
			const n = { ...b }
			n[nn] = n[oldName]
			delete n[oldName]
			return n
		})
		setOpenGroups((s) => {
			if (!s.has(oldName)) return s
			const n = new Set(s)
			n.delete(oldName)
			n.add(nn)
			return n
		})
		tpost('/api/tasks/group/rename', { from: oldName, to: nn }).catch(() => loadTasks(true))
	}
	const onDropToGroup = (group: string | null) => {
		const k = dragTask.current
		dragTask.current = null
		setDragOverGroup(null)
		if (k) setGroupOf(k, group)
	}
	// 카드 위로 드롭 → 그 카드 앞으로 이동(그룹 내 우선순위 순서). 다른 그룹이면 그 그룹으로 이동.
	const reorderOntoCard = (target: WorkItem) => {
		const from = dragTask.current
		dragTask.current = null
		setDragOverCard(null)
		setDragOverGroup(null)
		if (!from || from === target.key) return
		const grp = target.group || null
		const members = (tasks || [])
			.filter((x) => (x.group || null) === grp && !taskDone(x))
			.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || b.score - a.score)
		const keys = members.map((x) => x.key).filter((k) => k !== from)
		const at = keys.indexOf(target.key)
		keys.splice(at < 0 ? keys.length : at, 0, from)
		const idx: Record<string, number> = {}
		keys.forEach((k, i) => (idx[k] = i))
		setTasks((prev) =>
			prev ? prev.map((t) => (idx[t.key] != null ? { ...t, order: idx[t.key], group: grp } : t)) : prev
		)
		tpost('/api/tasks/reorder', { group: grp, keys })
			.then(() => {
				// 체인 그룹이면 순서 바뀐 대로 PR base 사슬 재적용
				if (grp && chainedGroups[grp]) {
					setChainBusy(grp)
					tpost('/api/tasks/chain', { group: grp, on: true })
						.then(() => loadTasks(true))
						.finally(() => setChainBusy(null))
				}
			})
			.catch(() => loadTasks(true))
	}

	// 티켓 없는 업무 → Notion 백로그 자동 생성 → 받은 티켓으로 개발 진행
	const createBacklogFor = (t: WorkItem) => {
		const fields = '상태=할일 (담당자·서비스·플랫폼은 MRM_BACKLOG_* 환경변수로 설정)'
		if (
			!confirm(
				`📋 백로그 자동 생성 — Notion에 새 일감 카드를 만듭니다.\n${fields}\n제목: ${t.title}\n\n진행할까요? (취소하면 직접 브랜치명 입력)`
			)
		) {
			setTaskSeed(buildSeed(t, reviewMode))
			setLauncherOpen(true)
			setTaskMsg({ ok: false, text: '티켓 없음 — 브랜치명을 적고 ▶ 작업 시작을 누르세요.' })
			return
		}
		if (backlogBusy.has(t.key)) return // 이미 진행 중 — 중복 방지
		const priority = (prompt('우선순위 (선택 — 비우면 미지정). 예: 높음 / 보통 / 낮음', '') || '').trim()
		const estimate = (prompt('예상 작업량/추정 (선택 — 비우면 미지정). 예: 0.5d / 2d', '') || '').trim()
		setBacklogBusy((s) => new Set(s).add(t.key)) // 잡 끝날 때까지 잠금 (jobs-watch가 해제)
		const links = [...t.links.slack, ...t.links.notion, ...t.links.figma]
		tpost('/api/tasks/backlog/start', {
			title: t.title,
			summary: t.summary || '',
			links,
			priority: priority || undefined,
			estimate: estimate || undefined,
			fromKey: t.key,
			autoStart: true,
		})
			.then((r: { ok?: boolean; jobId?: string; error?: string }) => {
				if (r.ok && r.jobId)
					setTaskMsg({
						ok: true,
						text: '📋 백로그 생성 중… 완료되면 티켓·링크가 이 카드에 반영되고 개발이 자동 시작됩니다 (상단 진행바).',
					})
				else {
					setTaskMsg({ ok: false, text: '백로그 생성 실패: ' + (r.error || '?') })
					setBacklogBusy((s) => {
						const n = new Set(s)
						n.delete(t.key)
						return n
					}) // 시작 실패 → 잠금 해제
				}
			})
			.catch((e) => {
				setTaskMsg({ ok: false, text: '⚠️ ' + String(e) })
				setBacklogBusy((s) => {
					const n = new Set(s)
					n.delete(t.key)
					return n
				})
			})
	}

	// 업무 진행 = 그 업무의 링크를 초기 지시로 묶어 Claude 에이전트 투입(+포커스).
	const progressTask = (t: WorkItem) => {
		const seed = buildSeed(t, reviewMode)
		const model = t.devModel || undefined // 카드에서 지정한 모델(간단한 작업은 sonnet/haiku)
		if (t.streams.length) {
			startTask({ cwd: t.streams[0].path, label: t.ticket || t.key, seed, busyKey: t.key, model })
		} else if (t.ticket) {
			startTask({ ticket: t.ticket, seed, desc: t.title, busyKey: t.key, model })
		} else {
			// 티켓 없음 → 백로그 자동 생성해서 티켓을 받아 진행
			createBacklogFor(t)
		}
	}
	// 🔄 초기화 — 워크트리(+에이전트 대화) 제거하고 새 워크트리에서 처음부터 다시 시작. PR·링크는 유지.
	const resetTask = (t: WorkItem) => {
		const wts = t.streams.filter((s) => !s.isMain)
		if (!wts.length) {
			setTaskMsg({ ok: false, text: '초기화할 워크트리가 없습니다 — ▶진행으로 먼저 시작하세요.' })
			return
		}
		if (
			!confirm(
				`🔄 초기화: ${t.ticket || t.key}\n• 워크트리 삭제(미커밋 변경 폐기): ${wts
					.map((s) => s.name)
					.join(
						', '
					)}\n• 에이전트 대화 기록 삭제 → 처음부터 새로 시작\n• PR·업무 링크·분류는 유지\n\n되돌릴 수 없습니다. 진행할까요?`
			)
		)
			return
		setProgressBusy((s) => new Set(s).add(t.key))
		setTaskMsg(null)
		tpost('/api/dev/reset-task', { key: t.key, seed: buildSeed(t, reviewMode), model: t.devModel || undefined })
			.then((r: { ok?: boolean; recreated?: boolean; name?: string; error?: string; errors?: string[] }) => {
				if (r.ok && r.recreated && r.name) {
					setOpenTerms((s) => new Set(s).add(r.name!))
					setFocus(r.name!)
					setTaskMsg({
						ok: true,
						text:
							'🔄 초기화 완료 — 새 워크트리에서 claude 처음부터 시작' +
							(r.errors && r.errors.length ? ` (경고: ${r.errors.join('; ')})` : ''),
					})
				} else if (r.ok) {
					setTaskMsg({
						ok: false,
						text:
							'워크트리는 제거됐지만 재생성 실패: ' +
							((r.errors || []).join('; ') || '?') +
							' — ▶진행으로 다시 시작하세요.',
					})
				} else
					setTaskMsg({ ok: false, text: '초기화 실패: ' + (r.error || (r.errors || []).join('; ') || '?') })
				loadTerms()
				loadTasks(true)
			})
			.catch((e) => setTaskMsg({ ok: false, text: '초기화 오류: ' + String(e) }))
			.finally(() =>
				setProgressBusy((s) => {
					const n = new Set(s)
					n.delete(t.key)
					return n
				})
			)
	}

	// 콕핏 폴링 (12s)
	useEffect(() => {
		let alive = true
		const tick = () =>
			fetch('/api/cockpit')
				.then((r) => r.json())
				.then((d) => alive && setCockpit(d))
				.catch(() => {})
		const first = setTimeout(tick, 350) // 첫 호출 지연 — tasks(보드)가 단일 스레드 백엔드를 먼저 쓰게
		const id = setInterval(tick, 20000)
		return () => {
			alive = false
			clearTimeout(first)
			clearInterval(id)
		}
	}, [])

	// cmux 세션 목록(이름만) 폴링 (5s)
	useEffect(() => {
		let alive = true
		const tick = () =>
			fetch('/api/cmux')
				.then((r) => r.json())
				.then((d) => alive && d.ok && setCmux(d.sessions))
				.catch(() => {})
		const first = setTimeout(tick, 700) // 첫 호출 지연 — 보드 먼저
		const id = setInterval(tick, 5000)
		return () => {
			alive = false
			clearTimeout(first)
			clearInterval(id)
		}
	}, [])

	// MRM 터미널(tmux) 목록 폴링 (5s)
	const loadTerms = () =>
		fetch('/api/term')
			.then((r) => r.json())
			.then((d) => d.ok && setTerms(d.sessions))
			.catch(() => {})
	useEffect(() => {
		loadTerms()
		const id = setInterval(loadTerms, 5000)
		return () => clearInterval(id)
	}, [])

	const createTerm = (cwd: string, command: string, label?: string) => {
		if (!cwd) return
		fetch('/api/term/create', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cwd, command, label }),
		})
			.then((r) => r.json())
			.then((r) => {
				if (r.ok) {
					setOpenTerms((s) => new Set(s).add(r.name))
					loadTerms()
				} else alert('터미널 생성 실패: ' + (r.error || '?'))
			})
			.catch((e) => alert('오류: ' + e))
	}
	const killTerm = (name: string) => {
		if (!confirm(`터미널 종료: ${name}?`)) return
		// 낙관적 즉시 제거 — 타일이 바로 사라지게 (백엔드 kill은 확실히 동작). 같은 base(cmux 리네임/중첩)도 함께 숨김.
		const base = name.replace(/_\d{10,}_.*$/, '')
		setOpenTerms((s) => {
			const n = new Set(s)
			n.delete(name)
			return n
		})
		setTerms((prev) => prev.filter((t) => t.name !== name && t.name.replace(/_\d{10,}_.*$/, '') !== base))
		fetch('/api/term/kill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name }),
		})
			.then((r) => r.json())
			.then((d: { ok?: boolean; error?: string }) => {
				if (d && d.ok === false) setTaskMsg({ ok: false, text: `⚠️ 종료 실패: ${d.error || '?'}` })
				// tmux kill 전파 후 재확정 (즉시 재조회하면 아직 목록에 남아 되살아나 보일 수 있음)
				setTimeout(loadTerms, 600)
				setTimeout(loadTerms, 1600)
			})
			.catch(() => loadTerms())
	}
	const toggleTerm = (name: string) =>
		setOpenTerms((s) => {
			const n = new Set(s)
			n.has(name) ? n.delete(name) : n.add(name)
			return n
		})

	// cmux 세션을 MRM 터미널로 인수: 같은 Claude 세션(--resume)을 그 워크트리에서 띄움.
	// ⚠️ cmux의 원본이 아직 살아있으면 같은 세션이 2곳에서 돌 수 있음 → 인수 후 cmux 쪽을 닫는 게 안전.
	const adoptCmux = (s: CmuxSession) => {
		if (
			!confirm(
				`"${s.title}" 세션을 MRM 터미널로 인수합니다.\n\nclaude --resume ${s.sessionId.slice(
					0,
					8
				)}… 로 같은 대화를 이어받습니다.\n원본 cmux 세션이 아직 떠 있다면 인수 후 닫아주세요(중복 실행 방지).`
			)
		)
			return
		createTerm(s.cwd, `claude --resume ${s.sessionId}`, s.title)
	}

	// ＋새 작업: 워크트리 자동 생성 → claude 실행 + 초기 지시 주입
	const startTask = (opts?: {
		cwd?: string
		label?: string
		ticket?: string
		seed?: string
		desc?: string
		busyKey?: string
		model?: string
	}) => {
		const ticket = opts?.ticket ?? taskTicket.trim()
		const seed = opts?.seed ?? (taskSeed.trim() || undefined)
		if (!opts?.cwd && !ticket) {
			setTaskMsg({ ok: false, text: '티켓/브랜치명을 입력하세요.' })
			return
		}
		const bk = opts?.busyKey
		if (bk) setProgressBusy((s) => new Set(s).add(bk)) // 이 카드만 로딩
		else setTaskBusy(true)
		setTaskMsg(null)
		const body = opts?.cwd
			? { cwd: opts.cwd, label: opts.label, seed, model: opts?.model }
			: { ticket, base: taskBase.trim() || undefined, seed, desc: opts?.desc, model: opts?.model }
		fetch('/api/dev/start-task', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
			.then((r) => r.json())
			.then(
				(r: {
					ok?: boolean
					error?: string
					stage?: string
					name?: string
					worktree?: { branch?: string; dir?: string; existed?: boolean }
					seeded?: boolean
					resumed?: boolean
				}) => {
					if (r.ok && r.name) {
						const where =
							r.worktree && !r.worktree.existed
								? `워크트리 ${r.worktree.dir} (${r.worktree.branch}) 생성 + `
								: ''
						setTaskMsg({
							ok: true,
							text: r.resumed
								? `✅ ${where}이전 대화 이어서 진행 (claude --continue)`
								: `✅ ${where}claude 시작${r.seeded ? ' + 지시 주입' : ''}`,
						})
						setOpenTerms((s) => new Set(s).add(r.name!))
						setFocus(r.name!)
						setTaskTicket('')
						setTaskSeed('')
						setLauncherOpen(false)
						loadTerms()
					} else {
						setTaskMsg({
							ok: false,
							text: `⚠️ ${
								r.stage === 'worktree'
									? '워크트리 생성 실패'
									: r.stage === 'term'
									? '터미널 생성 실패'
									: '실패'
							}: ${r.error || '?'}`,
						})
					}
				}
			)
			.catch((e) => setTaskMsg({ ok: false, text: '⚠️ ' + String(e) }))
			.finally(() => {
				if (bk)
					setProgressBusy((s) => {
						const n = new Set(s)
						n.delete(bk)
						return n
					})
				else setTaskBusy(false)
			})
	}

	// 🧪 QA — 이 업무의 TC를 생성하는 전용 claude 에이전트 투입 (dev 세션과 별도). notionParent 하위에 TC DB 생성.
	const qaTask = (t: WorkItem, notionParent = qaNotionUrl) => {
		const seed = buildQaSeed(t, reviewMode, notionParent)
		const cwd = t.streams[0]?.path
		setQaBusy((s) => new Set(s).add(t.key))
		tpost('/api/dev/qa', { ticket: t.ticket, cwd, desc: t.title, seed })
			.then((r: { ok?: boolean; name?: string; error?: string }) => {
				if (r.ok && r.name) {
					setTaskMsg({ ok: true, text: `🧪 QA 에이전트 투입 → ${r.name} (TC 생성 중)` })
					setOpenTerms((s) => new Set(s).add(r.name!))
					loadTerms()
					loadTasks(true)
				} else setTaskMsg({ ok: false, text: `⚠️ QA 실패: ${r.error || '?'}` })
			})
			.catch((e) => setTaskMsg({ ok: false, text: '⚠️ ' + String(e) }))
			.finally(() =>
				setQaBusy((s) => {
					const n = new Set(s)
					n.delete(t.key)
					return n
				})
			)
	}

	// E2E — 완성된 TC(Notion DB) 기반으로 playwright E2E 생성. TC 없으면 비활성(버튼에서 가드).
	const e2eTask = (t: WorkItem) => {
		if (!t.tc) return
		const seed = buildE2eSeed(t, reviewMode)
		const cwd = t.streams[0]?.path
		setE2eBusy((s) => new Set(s).add(t.key))
		tpost('/api/dev/e2e', { ticket: t.ticket, cwd, desc: t.title, seed })
			.then((r: { ok?: boolean; name?: string; error?: string }) => {
				if (r.ok && r.name) {
					setTaskMsg({ ok: true, text: `🎭 E2E 에이전트 투입 → ${r.name} (TC 기반 생성)` })
					setOpenTerms((s) => new Set(s).add(r.name!))
					loadTerms()
				} else setTaskMsg({ ok: false, text: `⚠️ E2E 실패: ${r.error || '?'}` })
			})
			.catch((e) => setTaskMsg({ ok: false, text: '⚠️ ' + String(e) }))
			.finally(() =>
				setE2eBusy((s) => {
					const n = new Set(s)
					n.delete(t.key)
					return n
				})
			)
	}

	// 그룹 E2E 일괄 — TC 있는 멤버만 순차 투입(TC 없는 건 건너뜀).
	const e2eGroup = (members: WorkItem[]) => {
		const withTc = members.filter((m) => m.tc)
		if (!withTc.length) {
			setTaskMsg({ ok: false, text: 'TC가 있는 업무가 없습니다 — 먼저 QA로 TC를 만드세요.' })
			return
		}
		const skip = members.length - withTc.length
		if (
			!confirm(
				`TC가 있는 ${withTc.length}건에 E2E 에이전트를 순차 투입합니다 (2초 간격).${
					skip ? `\nTC 없는 ${skip}건은 건너뜀.` : ''
				}`
			)
		)
			return
		setTaskMsg({ ok: true, text: `🎭 E2E 일괄 — ${withTc.length}건 순차 투입…` })
		withTc.forEach((t, i) => setTimeout(() => e2eTask(t), i * 2000))
	}

	// 그룹 QA 일괄 → 오케스트레이터에 위임(추천). 지휘자 없으면 투입하고, Notion 위치와 함께 QA 지시.
	const qaGroup = (members: WorkItem[]) => {
		const g = members[0]?.group
		if (!g) return
		const loc = window.prompt(
			'TC 문서를 만들 Notion 부모 페이지 URL/ID (지휘자가 그 하위에 백로그별 TC DB 생성):',
			qaNotionUrl
		)
		if (loc === null) return
		const parent = loc.trim()
		setQaNotionUrl(parent)
		localStorage.setItem('mrm-qa-notion', parent)
		setTaskMsg({ ok: true, text: `🎼 '${g}' 지휘자에게 그룹 QA 위임 중…` })
		fetch('/api/orch/start', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ group: g }),
		})
			.then(() =>
				tpost('/api/orch/tell', {
					group: g,
					text: `이 그룹의 QA TC를 만들어줘. 단 반드시 개발이 끝난(PR 있음/작업완료) 티켓만 대상 — 개발 전이면 건너뛰고 마티에게 알려. 팀 예시 TC 템플릿을 '복제'해 부모(${parent}) 하위에 티켓당 풀페이지 DB 1개씩(스키마 재해석 금지), 도출한 TC를 행으로. Notion 쓰기는 리밋 있으니 네가 순차로, TC 콘텐츠 생성이 필요한 건만 서브에이전트로 병렬. 각 DB 완성하면 curl POST /api/tasks/tc 로 등록. 먼저 어떤 티켓이 QA 가능/불가한지 한 줄 보고하고 진행.`,
				})
			)
			.then(() => {
				setOrchOpen((s) => new Set(s).add(g))
				setTaskMsg({ ok: true, text: `🎼 '${g}' 지휘자에게 QA 위임 — 콘솔 확인` })
			})
			.catch((e) => setTaskMsg({ ok: false, text: '⚠️ ' + String(e) }))
	}

	// 티켓 상태 분류 → 지휘자가 각 티켓에 맞는 액션을 하도록 (유연 진행)
	const taskStage = (t: WorkItem): { stage: string; action: string } => {
		const prs = t.prs || []
		const merged = prs.some((p) => (p.state || '') === 'MERGED')
		const openPr = prs.some((p) => (p.state || 'OPEN') === 'OPEN' || p.draft)
		const hasAgent = agentsFor(t).length > 0
		if (!t.ticket)
			return {
				stage: '백로그 없음',
				action: '개발 안 된 상태 → 백로그 생성(/api/tasks/backlog/start) 후 개발 에이전트 투입',
			}
		if (t.tc) return { stage: 'TC 있음', action: '개발·QA 완료 단계 → E2E 생성 대상(원하면). 추가 개발 불필요' }
		if (merged && !openPr) return { stage: 'PR 머지됨', action: '개발 완료 → QA(TC) 진행 가능 (/api/dev/qa)' }
		if (openPr) return { stage: 'PR 열림', action: '개발 중/리뷰 대기 → CI·리뷰 상태 확인만, 아직 QA 하지 마' }
		if (hasAgent) return { stage: '개발 진행 중', action: '개발 에이전트 이미 도는 중 → 진행 상황만 확인' }
		return {
			stage: '백로그 있음·PR 없음',
			action: '상황 파악 필요 → 요구사항 확인 후 개발 에이전트 투입(/api/dev/start-task)',
		}
	}
	// 그룹 자동 진행 → 지휘자에게 위임. 각 티켓 상태를 넘겨주고, 상태에 맞게 유연하게 라우팅하게 함.
	const autoGroup = (members: WorkItem[]) => {
		const g = members[0]?.group
		if (!g) return
		if (
			!confirm(
				`'${g}' 지휘자에게 자동 진행을 위임합니다.\n각 티켓의 상태(백로그/PR/개발/TC)를 보고 알맞은 액션(개발·파악·QA)을 진행합니다.`
			)
		)
			return
		const lines = members.map((t) => {
			const s = taskStage(t)
			return `- ${t.ticket || t.key} (${t.title || ''}): [${s.stage}] → ${s.action}`
		})
		setTaskMsg({ ok: true, text: `🎼 '${g}' 지휘자에게 자동 진행 위임 중…` })
		fetch('/api/orch/start', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ group: g }),
		})
			.then(() =>
				tpost('/api/orch/tell', {
					group: g,
					text: `이 그룹을 각 티켓 상태에 맞게 '유연하게' 진행해줘. 아래는 지금 각 티켓의 상태와 권장 액션이야:\n${lines.join(
						'\n'
					)}\n\n원칙: ① 개발이 안 된 것(백로그 없음/PR 없음)은 개발부터 ② PR 열린 건 리뷰·CI 확인만(QA 금지) ③ 머지된 것만 QA ④ 애매하면 파악 후 마티에게 보고. 개발=/api/dev/start-task, QA=/api/dev/qa, 백로그생성=/api/tasks/backlog/start. 각 진행을 /api/orch/event로 보고. 먼저 티켓별로 뭘 할지 한 줄씩 계획 보고하고 진행해.`,
				})
			)
			.then(() => {
				setOrchOpen((s) => new Set(s).add(g))
				setTaskMsg({ ok: true, text: `🎼 '${g}' 자동 진행 위임 완료 — 콘솔 확인` })
			})
			.catch((e) => setTaskMsg({ ok: false, text: '⚠️ ' + String(e) }))
	}

	// 작업 스트림 한 줄 (업무 카드 안에서 재사용)
	// 디버깅 ✕ — 개발서버 끄기 (포트 프로세스 + dev 세션 종료)
	const stopDev = (port: number, cwd?: string) => {
		if (!confirm(`개발서버(:${port})를 끕니다.`)) return
		tpost('/api/dev/server/stop', { port, cwd })
			.then(() => setTaskMsg({ ok: true, text: `🛑 개발서버 :${port} 종료` }))
			.finally(() => {
				fetch('/api/cockpit')
					.then((r) => r.json())
					.then(setCockpit)
					.catch(() => {})
				loadTerms()
			})
	}
	// ▶ dev — 개발서버를 지정 포트로 켜고 디버깅 페이지로 바로 이동 (스트림 또는 에이전트 cwd)
	const startDevServer = (s: { path: string; ticket?: string | null; name?: string }) => {
		tpost('/api/dev/server', { cwd: s.path, label: 'dev-' + (s.ticket || s.name) })
			.then((d: { ok?: boolean; port?: number; name?: string; error?: string }) => {
				if (d.ok && d.port) {
					if (d.name) setOpenTerms((o) => new Set(o).add(d.name!))
					loadTerms()
					navigate(`/command?port=${d.port}`)
				} else alert('개발서버 시작 실패: ' + (d.error || '?'))
			})
			.catch((e) => alert('오류: ' + String(e)))
	}
	// PR만 있고 로컬 워크트리 없는 브랜치 → 그 브랜치를 로컬 워크트리로 체크아웃(원격 fetch) + 개발서버 켜기
	const [branchBusy, setBranchBusy] = useState<string | null>(null)
	const startBranchDev = (branch: string) => {
		setBranchBusy(branch)
		setTaskMsg({ ok: true, text: `🌿 '${branch}' 로컬 체크아웃 + 개발서버 켜는 중… (원격 fetch 포함)` })
		tpost('/api/dev/branch-server', { branch })
			.then((d: { ok?: boolean; port?: number; name?: string; error?: string }) => {
				if (d.ok && d.port) {
					if (d.name) setOpenTerms((o) => new Set(o).add(d.name!))
					loadTerms()
					loadTasks(true)
					setTaskMsg({ ok: true, text: `▶ '${branch}' :${d.port} 실행 중 — 디버깅으로 이동` })
					navigate(`/command?port=${d.port}`)
				} else setTaskMsg({ ok: false, text: '로컬 띄우기 실패: ' + (d.error || '?') })
			})
			.catch((e) => setTaskMsg({ ok: false, text: '오류: ' + String(e) }))
			.finally(() => setBranchBusy(null))
	}

	// 한 작업(티켓)에 여러 브랜치/PR → 브랜치별로 (워크트리 + 그 브랜치 PR) 묶어 각각 독립 테스트.
	const branchGroups = (t: WorkItem) => {
		const map = new Map<
			string,
			{ branch: string; surface: string | null; stream: Stream | null; prs: WorkItem['prs'] }
		>()
		const get = (b: string) => {
			if (!map.has(b)) map.set(b, { branch: b, surface: null, stream: null, prs: [] })
			return map.get(b)!
		}
		for (const s of t.streams) {
			if (s.isMain) continue
			get(s.branch).stream = s
		}
		for (const p of t.prs) {
			const g = get(p.branch || `#${p.number}`)
			g.prs.push(p)
			if (p.surface && !g.surface) g.surface = p.surface
		}
		// 개발 순서로 정렬 — PR 번호(낮을수록 먼저 개발). PR 없는(개발 중) 브랜치는 맨 뒤.
		const orderKey = (g: { prs: WorkItem['prs'] }) =>
			g.prs.length ? Math.min(...g.prs.map((p) => p.number)) : Number.MAX_SAFE_INTEGER
		return [...map.values()].filter((g) => g.stream || g.prs.length).sort((a, b) => orderKey(a) - orderKey(b))
	}
	// 스트림 컨트롤(브랜치명 제외) — 브랜치 영역 안에서 재사용
	const streamCtl = (s: Stream) => (
		<>
			{s.dirty > 0 && (
				<span className="ck-chip warn" title="미커밋 변경">
					●{s.dirty}
				</span>
			)}
			{s.ahead > 0 && (
				<span className="ck-chip up" title="base 대비 앞선 커밋">
					↑{s.ahead}
				</span>
			)}
			{s.dev.length ? (
				s.dev.map((d) => (
					<span key={d.port} className="ck-chip debug dbg-wrap">
						<button
							className="dbg-main"
							onClick={() => navigate(`/command?port=${d.port}`)}
							title={`디버깅 :${d.port}`}
						>
							🐞 디버깅 :{d.port}
						</button>
						<button
							className="dbg-x"
							onClick={(e) => {
								e.stopPropagation()
								stopDev(d.port, s.path)
							}}
							title="개발서버 끄기"
						>
							✕
						</button>
					</span>
				))
			) : (
				<button
					className="ck-chip devstart"
					onClick={() => startDevServer(s)}
					title="이 브랜치 개발서버 켜기 + 디버깅으로"
				>
					▶ dev
				</button>
			)}
			<a className="ck-chip vscode" href={`vscode://file${encodeURI(s.path)}`} title={`VSCode — ${s.path}`}>
				🆚 VSCode
			</a>
			<button
				className="stream-term"
				onClick={() => startTask({ cwd: s.path, label: s.ticket || s.name })}
				disabled={taskBusy}
				title="이 워크트리에서 에이전트 시작"
			>
				🤖 에이전트
			</button>
		</>
	)
	const branchSection = (
		g: { branch: string; surface: string | null; stream: Stream | null; prs: WorkItem['prs'] },
		i: number,
		total: number,
		t: WorkItem
	) => {
		// 이 브랜치의 대표 PR(열린 것 우선) → 리뷰/개선 대상
		const pr = g.prs.find((p) => (p.state || 'OPEN') === 'OPEN') || g.prs[0] || null
		const prKey = pr ? `${pr.repo}#${pr.number}` : null
		const rv = pr && prKey && t.prReviews ? t.prReviews[prKey] : null
		return (
			<div className="rcd-branch" key={g.branch}>
				<div className="rcd-branch-head">
					<span className="rcd-branch-ord" title="개발 순서 (PR 번호 기준 — 낮을수록 먼저)">
						{i + 1}/{total}
					</span>
					<span className="rcd-branch-name" title={g.branch}>
						⑂ {g.branch}
					</span>
					{g.surface && <span className="rcd-branch-surface">{g.surface.toUpperCase()}</span>}
					{g.prs.map((p) => (
						<span className="rcd-pr-slot" key={p.repo + p.number}>
							<a
								className={`rcd-pr ${(p.state || 'open').toLowerCase()}`}
								href={p.url}
								target="_blank"
								rel="noreferrer"
								title={`${p.repo} #${p.number} · ${p.state || 'OPEN'}${p.ci ? ' · CI ' + p.ci : ''}${
									p.reviewDecision === 'APPROVED'
										? ' · 승인됨'
										: p.reviewDecision === 'CHANGES_REQUESTED'
										? ' · 변경요청'
										: p.reviewDecision === 'REVIEW_REQUIRED'
										? ' · 리뷰대기'
										: ''
								}`}
							>
								🔀 #{p.number}
								{p.draft
									? '·draft'
									: p.state === 'MERGED'
									? '·머지'
									: p.state === 'CLOSED'
									? '·닫힘'
									: ''}
								{p.ci && p.ci !== 'none'
									? p.ci === 'pass'
										? ' ✓'
										: p.ci === 'fail'
										? ' ✗'
										: ' ⏳'
									: ''}
							</a>
							{p.reviewDecision === 'APPROVED' && (
								<span className="rcd-approve ok" title="리뷰 승인됨 (approved)">
									✅
								</span>
							)}
							{p.reviewDecision === 'CHANGES_REQUESTED' && (
								<span className="rcd-approve chg" title="변경 요청됨 (changes requested)">
									🔴
								</span>
							)}
							{p.reviewDecision === 'REVIEW_REQUIRED' && p.state === 'OPEN' && !p.draft && (
								<span className="rcd-approve wait" title="리뷰 대기 중">
									⏳
								</span>
							)}
						</span>
					))}
				</div>
				{/* 브랜치 설명 — 이 브랜치가 뭘 하는지 (PR 제목 우선, 없으면 마지막 커밋). 각각 검증 기준. */}
				{g.prs.map((p) => (
					<div className="rcd-branch-desc" key={'d' + p.number} title={p.title}>
						{p.title.replace(/^(feat|fix|chore|refactor|style|test|docs)\([^)]*\):\s*/, '')}
					</div>
				))}
				{!g.prs.length && g.stream?.lastSubject && (
					<div className="rcd-branch-desc" title={g.stream.lastSubject}>
						{g.stream.lastSubject.replace(/^(feat|fix|chore|refactor|style|test|docs)\([^)]*\):\s*/, '')}
					</div>
				)}
				<div className="rcd-branch-ctl">
					{g.stream ? (
						streamCtl(g.stream)
					) : (
						<>
							<button
								className="ck-chip devstart"
								disabled={branchBusy === g.branch}
								onClick={() => startBranchDev(g.branch)}
								title="이 브랜치를 로컬 워크트리로 체크아웃(원격 fetch) + 개발서버 켜기 → 로컬에서 이 PR 테스트"
							>
								{branchBusy === g.branch ? '띄우는 중…' : '▶ 로컬 띄우기'}
							</button>
							<span className="muted" style={{ fontSize: 10.5 }}>
								PR만 · 로컬 워크트리 없음
							</span>
						</>
					)}
					{/* 🔎 리뷰 → 🔧 개선 (1클릭 리뷰, 2클릭 리뷰대로 개선) */}
					{pr &&
						prKey &&
						(() => {
							const busy = rv?.reviewing || rv?.improving || rv?.applying
							let label = '🔎 리뷰'
							let onClick = () => reviewPr(t, pr)
							let cls = 'ck-chip rvw'
							if (rv?.reviewing) label = '🔎 리뷰 중…'
							else if (rv?.improving) label = '🔧 개선 중…'
							else if (rv?.review && rv.review.issues.length > 0 && !rv?.improved) {
								label = '🔧 리뷰대로 개선'
								onClick = () => improvePr(t, pr, rv.review || null)
								cls = 'ck-chip imp'
							} else if (rv?.review) {
								// 리뷰 완료(지적 없음) 또는 이미 개선함 → 다시 리뷰만 제공
								label = '🔎 다시 리뷰'
							}
							return (
								<>
									<button
										className={cls}
										disabled={!!busy}
										onClick={onClick}
										title="1클릭 리뷰 → 2클릭 리뷰대로 개선 (내 PR만 커밋·푸시)"
									>
										{label}
									</button>
									{pr.mine !== false && (
										<button
											className="ck-chip apr"
											disabled={!!busy}
											onClick={() => applyReviewPr(t, pr)}
											title="PR에 올라온 (남의) 리뷰·라인 코멘트를 코드에 반영 + 커밋·푸시하고, 항목별 답글을 GitHub에 자동 게시 (내 PR만)"
										>
											{rv?.applying ? '📥 확인 중…' : '📥 PR 리뷰 확인'}
										</button>
									)}
									{rv?.applied && (
										<button
											className="ck-chip ghost"
											onClick={() =>
												alert(
													`📥 PR #${pr.number} 리뷰 확인${rv.applied!.pushed ? ' · ✅푸시됨' : ' (변경 없음)'}\n\n${rv.applied!.summary}` +
														(rv.applied!.applied.length ? `\n\n[반영]\n· ${rv.applied!.applied.join('\n· ')}` : '') +
														(rv.applied!.skipped.length ? `\n\n[건너뜀]\n· ${rv.applied!.skipped.join('\n· ')}` : '')
												)
											}
											title="PR 리뷰 확인 결과 보기"
										>
											📥 {rv.applied.applied.length ? rv.applied.applied.length + '건' : rv.applied.skipped.length ? '건너뜀' : '미반영'}
											{rv.applied.pushed ? ' · ✅푸시' : ''}
											{rv.applied.commented ? ' · 💬' : ''}
											{rv.applied.skipped.length ? ` · ⏭${rv.applied.skipped.length}` : ''}
										</button>
									)}
									{rv?.review && (
										<button
											className="ck-chip ghost"
											disabled={!!busy || !!rv?.questioning}
											onClick={() =>
												setQuestionModal({
													key: t.key,
													repo: pr.repo,
													prNum: pr.number,
													title: t.title,
												})
											}
											title="리뷰 판정에 이의 제기 / 질문"
										>
											{rv?.questioning ? '🗣️ 확인 중…' : '🗣️ 리뷰 항의'}
										</button>
									)}
									{rv?.review && (
										<button
											className="ck-chip ghost"
											onClick={() =>
												setReviewModal({
													prKey,
													prNum: pr.number,
													title: t.title,
													review: rv.review!,
													improved: rv.improved || null,
													question: rv.question || null,
												})
											}
											title="리뷰 결과 열어보기"
										>
											🔎 리뷰 {rv.review.issues.length ? rv.review.issues.length + '건' : '통과'}
											{rv.improved ? (rv.improved.pushed ? ' · ✅푸시' : ' · ✅') : ''}
											{rv.question ? ' · 🗣️' : ''}
										</button>
									)}
								</>
							)
						})()}
				</div>
			</div>
		)
	}
	// 업무 ↔ 에이전트(터미널) 매칭: 같은 워크트리 cwd거나 라벨에 티켓이 든 것
	const agentsFor = (t: WorkItem) =>
		terms.filter(
			(tm) =>
				t.streams.some((s) => s.path === tm.cwd) ||
				(t.ticket && tm.label.includes(t.ticket)) ||
				tm.label === t.key
		)
	// '완료'(완료 섹션으로 수납) = PR 전부 머지 AND 활성 에이전트/워크트리 없음. 티켓의 옛 PR이 머지됐어도 지금 작업 중이면 완료 아님.
	const taskDone = (t: WorkItem) =>
		isDone(t) && agentsFor(t).length === 0 && !t.streams.some((s) => s.dirty || (s.dev && s.dev.length))
	const agentStat = (tm: TermSession) => {
		const s = tm.status || {}
		if (s.needsAuth) return { c: 'auth', t: '⚠️ 인증필요' }
		if (s.working) return { c: 'work', t: '⚙️ 진행 중' }
		if (s.waiting) return { c: 'wait', t: '💬 질문 대기' }
		return { c: 'idle', t: '✅ 대기' }
	}
	const headAgent = (agents: TermSession[]) =>
		agents.find((a) => agentStat(a).c === 'work') ||
		agents.find((a) => agentStat(a).c === 'wait') ||
		agents.find((a) => agentStat(a).c === 'auth') ||
		agents[0]

	// 진행중 = 지금 작업이 돌고 있음 (에이전트 작업·리뷰중·리뷰/개선 잡·dev서버·비개발처리)
	// 색상은 작업카드 상태점(rc-dot)과 동일 팔레트 — work=초록 wait=노랑 auth=빨강 리뷰=보라 dev/ops=파랑
	const progressStatus = (t: WorkItem): { on: boolean; label: string; color: string } => {
		const ags = agentsFor(t)
		// 지금 실제로 돌고 있는(work) 에이전트만 완료 여부와 무관하게 항상 진행중 — 머지된 뒤의 후속 작업일 수 있으므로.
		if (ags.some((tm) => agentStat(tm).c === 'work'))
			return { on: true, label: '⚙️ 에이전트 작업중', color: 'var(--green)' }
		// 나머지 신호(질문대기·인증필요·리뷰/개선/반영 플래그·비개발·dev 서버·열린 PR)는 '완료(PR 전부 머지)'가 아닐 때만 진행중으로 인정.
		// 작업이 끝나(머지) PR이 닫혔는데 안 죽은 대기 세션·남은 dev 서버·정리 안 된 플래그가 완료건을 진행 현황에 섞지 않게.
		if (!isDone(t)) {
			if (ags.some((tm) => agentStat(tm).c === 'wait'))
				return { on: true, label: '💬 질문 대기', color: 'var(--yellow)' }
			if (ags.some((tm) => agentStat(tm).c === 'auth'))
				return { on: true, label: '⚠️ 인증 필요', color: 'var(--red)' }
			if (t.prReviews && Object.values(t.prReviews).some((rv) => rv.applying))
				return { on: true, label: '📥 PR 리뷰 확인중', color: 'var(--accent2)' }
			if (t.prReviews && Object.values(t.prReviews).some((rv) => rv.improving))
				return { on: true, label: '🔧 개선중', color: 'var(--accent2)' }
			if (t.prReviews && Object.values(t.prReviews).some((rv) => rv.reviewing))
				return { on: true, label: '🔎 리뷰중', color: 'var(--accent2)' }
			if (t.opsRunning) return { on: true, label: '📋 비개발 처리중', color: 'var(--accent)' }
			if (t.streams.some((st) => st.dev && st.dev.length))
				return { on: true, label: '▶ dev 서버', color: 'var(--accent)' }
			if (prBucket(t) === 'ready') return { on: true, label: '👀 리뷰 대기', color: 'var(--accent2)' }
		}
		return { on: false, label: '', color: 'var(--muted)' }
	}
	const isInProgress = (t: WorkItem) => progressStatus(t).on
	const isWaiting = (t: WorkItem) => !isDone(t) && agentsFor(t).some((tm) => agentStat(tm).c === 'wait')
	// 도크에서 업무 클릭 → 그룹 열고 카드로 스크롤
	const scrollToTask = (key: string) => {
		const t = tasks?.find((x) => x.key === key)
		if (t) setOpenGroups((set) => new Set(set).add(t.group ?? '__none__'))
		setHighlightKey(key) // 대상 카드 강조
		setTimeout(
			() =>
				document
					.querySelector(`[data-taskkey="${key}"]`)
					?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
			120
		)
		setTimeout(() => setHighlightKey((k) => (k === key ? null : k)), 2600)
	}
	const ackDone = (key: string) => {
		ackedDoneRef.current.add(key)
		setJustCompleted((x) => x.filter((y) => y.key !== key))
	}
	const ackWait = (key: string) => {
		ackedWaitRef.current.add(key)
		setJustWaiting((x) => x.filter((y) => y.key !== key))
	}
	// 진행중이던 업무가 완료/질문대기로 전환되는 순간 감지 → 각각 확인 대기 목록에 추가 (세션 라이브)
	useEffect(() => {
		if (!tasks) return
		const prev = prevInProgRef.current
		const prevWait = prevWaitRef.current
		const nowInProg = new Set<string>()
		const nowWait = new Set<string>()
		const newlyDone: { key: string; title: string; at: number }[] = []
		const newlyWaiting: { key: string; title: string; at: number }[] = []
		for (const t of tasks) {
			// 실제로 다시 작업중이 되면 그 업무의 확인(ack) 상태를 해제 — 다음 완료/대기 전환은 새로 알림 대상.
			if (agentsFor(t).some((tm) => agentStat(tm).c === 'work')) {
				ackedDoneRef.current.delete(t.key)
				ackedWaitRef.current.delete(t.key)
			}
			if (isInProgress(t)) nowInProg.add(t.key)
			else if (taskDone(t) && prev.has(t.key) && !ackedDoneRef.current.has(t.key))
				newlyDone.push({ key: t.key, title: t.title, at: Date.now() })
			if (isWaiting(t)) {
				nowWait.add(t.key)
				if (!prevWait.has(t.key) && !ackedWaitRef.current.has(t.key))
					newlyWaiting.push({ key: t.key, title: t.title, at: Date.now() })
			}
		}
		if (newlyDone.length) {
			setJustCompleted((cur) => {
				const seen = new Set(cur.map((c) => c.key))
				const add = newlyDone.filter((c) => !seen.has(c.key))
				return add.length ? [...add, ...cur].slice(0, 40) : cur
			})
			if (!progDockOpen) setProgDockOpen(true)
		}
		if (newlyWaiting.length) {
			setJustWaiting((cur) => {
				const seen = new Set(cur.map((c) => c.key))
				const add = newlyWaiting.filter((c) => !seen.has(c.key))
				return add.length ? [...add, ...cur].slice(0, 40) : cur
			})
			if (!progDockOpen) setProgDockOpen(true)
		}
		// 질문이 해소돼 더 이상 대기가 아니면(응답 완료 등) 미확인 목록에서도 자동 정리
		setJustWaiting((cur) => cur.filter((c) => nowWait.has(c.key)))
		prevInProgRef.current = nowInProg
		prevWaitRef.current = nowWait
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tasks])
	// 오른쪽 고정 도크(진행현황/실패)가 콘텐츠 위를 덮어 타일 ✕·버튼 클릭을 가로채는 문제 방지 —
	// 도크가 실제로 떠 있는 동안 .content 오른쪽에 그만큼 여백을 확보해 겹침 자체를 없앤다.
	useEffect(() => {
		const progPresent = (tasks || []).some(isInProgress) || justCompleted.length > 0 || justWaiting.length > 0
		const failPresent = (failures?.length || 0) > 0
		const wide = (progPresent && progDockOpen) || (failPresent && failDockOpen)
		const tabOnly = !wide && ((progPresent && !progDockOpen) || (failPresent && !failDockOpen))
		const cls = document.documentElement.classList
		cls.toggle('mrm-dock-wide', wide)
		cls.toggle('mrm-dock-tab', tabOnly)
		return () => {
			cls.remove('mrm-dock-wide')
			cls.remove('mrm-dock-tab')
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tasks, failures, justCompleted, justWaiting, progDockOpen, failDockOpen])
	// 업무에 묶인 터미널 이름 (전역 그리드에선 제외 — 업무 카드 안에서 보여줌)
	const taskTermNames = new Set<string>()
	if (tasks) for (const t of tasks) for (const a of agentsFor(t)) taskTermNames.add(a.name)
	const otherTerms = terms.filter((tm) => !taskTermNames.has(tm.name))

	// 업무 카드 (드래그해 그룹에 넣을 수 있음)
	const renderCard = (t: WorkItem) => {
		const agents = agentsFor(t)
		const ha = agents.length ? headAgent(agents) : null
		const level = taskLevel[t.key] || 0 // 0 접힘 · 1 요약 · 2 전체
		const deleting = deletingKeys.has(t.key)
		const devPort = t.streams.flatMap((s) => s.dev || []).map((d) => d.port)[0]
		// ── 리디자인 파생값 (dc.html 카드) ──
		const hst = ha ? agentStat(ha).c : '' // work | wait | auth | idle
		const hasWt = t.streams.some((s) => !s.isMain)
		const active = hasWt || t.prs.some((p) => p.state === 'OPEN')
		const inReview = prBucket(t) === 'ready' // 열린 PR(초안·머지 아님) = 리뷰 중 → 진행 중인 작업(보라)
		// 이 작업에 저장된 PR 리뷰들 — 접힌 카드 헤더에서도 바로 열어볼 수 있게
		const reviewedPrs = t.prReviews
			? Object.entries(t.prReviews)
					.filter(([, rv]) => rv.review)
					.map(([prKey, rv]) => ({ prKey, rv }))
			: []
		const dotColor =
			taskDone(t)
				? 'var(--green)' // 완료(PR 전부 머지) — 진행중(work=초록 펄스)과 헷갈리지 않게 펄스 없는 고정 초록
				: hst === 'work'
				? 'var(--green)'
				: hst === 'wait'
				? 'var(--yellow)'
				: hst === 'auth'
				? 'var(--red)'
				: inReview
				? 'var(--accent2)'
				: active
				? 'var(--accent)'
				: 'var(--muted)'
		const kindIcon = t.taskClass === 'ops' ? '📋' : t.taskClass === 'unsure' ? '❓' : '' // dev/미분류는 아이콘 없음
		const noteText = hst === 'wait' ? '질문 대기' : hst === 'auth' ? '인증 필요' : ''
		const noteColor = hst === 'wait' ? 'var(--yellow)' : 'var(--red)'
		const metaText = [
			ha?.model && modelTag(ha.model).toUpperCase(),
			...t.prs.slice(0, 2).map((p) => '#' + p.number),
		]
			.filter(Boolean)
			.join(' · ')
		const surface = t.prs.find((p) => p.surface)?.surface || null
		const actGhost = hst === 'wait'
		return (
			<div
				key={t.key}
				data-taskkey={t.key}
				className={`task-card ${t.manual ? 'manual' : ''} lv${level} ${deleting ? 'deleting' : ''} ${
					dragOverCard === t.key ? 'dragover-card' : ''
				} ${highlightKey === t.key ? 'hl' : ''}`}
				draggable={!deleting}
				onDragStart={(e) => {
					dragTask.current = t.key
					e.dataTransfer.effectAllowed = 'move'
				}}
				onDragEnd={() => {
					dragTask.current = null
					setDragOverGroup(null)
					setDragOverCard(null)
				}}
				onDragOver={(e) => {
					if (dragTask.current && dragTask.current !== t.key) {
						e.preventDefault()
						e.stopPropagation()
						if (dragOverCard !== t.key) setDragOverCard(t.key)
					}
				}}
				onDragLeave={() => setDragOverCard((d) => (d === t.key ? null : d))}
				onDrop={(e) => {
					e.preventDefault()
					e.stopPropagation()
					reorderOntoCard(t)
				}}
			>
				<div className="rc-row" onClick={() => bumpLevel(t.key)}>
					<span
						className="rc-dot"
						style={{
							background: dotColor,
							animation: hst === 'work' ? 'pulseDot 1.8s ease-in-out infinite' : 'none',
						}}
					/>
					{kindIcon && (
						<span
							className="rc-kind"
							title="종류 — 클릭해 개발/비개발 변경"
							onClick={(e) => {
								e.stopPropagation()
								setClassModal(t)
							}}
						>
							{kindIcon}
						</span>
					)}
					<span
						className="rc-title"
						title="더블클릭해 제목 수정"
						onDoubleClick={(e) => {
							e.stopPropagation()
							editTitle(t.key, t.title)
						}}
					>
						{t.title}
					</span>
					{inReview && !noteText && (
						<span className="rc-inreview" title="리뷰 중 — 진행 중인 작업">
							진행중
						</span>
					)}
					{reviewedPrs.map(({ prKey, rv }) => (
						<button
							key={prKey}
							className={`rc-review-badge ${
								rv.review!.verdict === 'request_changes'
									? 'chg'
									: rv.review!.issues.length
									? 'has'
									: 'ok'
							}`}
							title="리뷰 결과 열어보기"
							onClick={(e) => {
								e.stopPropagation()
								setReviewModal({
									prKey,
									prNum: Number(prKey.split('#')[1]) || 0,
									title: t.title,
									review: rv.review!,
									improved: rv.improved || null,
									question: rv.question || null,
								})
							}}
						>
							🔎 리뷰{rv.review!.issues.length ? ` ${rv.review!.issues.length}` : ' ✓'}
							{rv.improved ? '·✅' : ''}
							{rv.question ? '·🗣️' : ''}
						</button>
					))}
					{noteText && (
						<span className="rc-note" style={{ color: noteColor }}>
							{noteText}
						</span>
					)}
					<span className="rc-gap" />
					{(t.devModel || ha?.model || t.prs.length > 0 || surface) && (
						<span className="rc-meta">
							{(t.devModel || ha?.model) && (
								<button
									className="rc-model"
									title="클릭해 모델 변경 (opus→sonnet→haiku)"
									onClick={(e) => {
										e.stopPropagation()
										const order = ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5']
										const idx = order.findIndex(
											(o) => modelTag(o) === modelTag(t.devModel || ha?.model)
										)
										setTaskModelOf(t.key, order[(idx + 1) % order.length])
									}}
								>
									{modelTag(t.devModel || ha?.model).toUpperCase()}
								</button>
							)}
							{t.prs.slice(0, 2).map((p) => (
								<a
									key={p.number}
									className="rc-pr"
									href={p.url}
									target="_blank"
									rel="noreferrer"
									title={`${p.repo}#${p.number} 열기`}
									onClick={(e) => e.stopPropagation()}
								>
									#{p.number}
								</a>
							))}
							{surface && <span className="rc-env">{surface.toUpperCase()}</span>}
						</span>
					)}
					<span className="rc-tools" onClick={(e) => e.stopPropagation()}>
						{hasWt && (
							<span
								className="rc-tool"
								title="초기화 — 워크트리·에이전트 대화 제거하고 처음부터 (PR·링크 유지)"
								onClick={() => resetTask(t)}
							>
								{progressBusy.has(t.key) ? '…' : '🔄'}
							</span>
						)}
						<span
							className="rc-tool"
							title="QA 테스트케이스(TC) 생성"
							onClick={() => !qaBusy.has(t.key) && qaTask(t)}
						>
							{qaBusy.has(t.key) ? '…' : '🧪'}
						</span>
						<span
							className={`rc-tool ${!t.tc ? 'dis' : ''}`}
							title={t.tc ? 'E2E 테스트(playwright) 생성' : 'TC 없음 — 먼저 QA'}
							onClick={() => t.tc && !e2eBusy.has(t.key) && e2eTask(t)}
						>
							{e2eBusy.has(t.key) ? '…' : '🎭'}
						</span>
						{!deleting && (
							<span
								className="rc-tool"
								title="보관 — 해결 이력(날짜별)로 저장하고 워크트리 정리 (PR·기록 보존, 복원 가능)"
								onClick={() => archiveTask(t)}
							>
								📦
							</span>
						)}
						{deleting ? (
							<span className="rc-tool">⏳</span>
						) : (
							<span
								className="rc-tool del"
								title="업무 삭제 — 워크트리 제거 + 열린 PR 닫기"
								onClick={() => removeWorkItem(t)}
							>
								×
							</span>
						)}
					</span>
					<button
						className={`rc-act ${actGhost ? 'ghost' : ''}`}
						onClick={(e) => {
							e.stopPropagation()
							progressTask(t)
						}}
						disabled={progressBusy.has(t.key) || backlogBusy.has(t.key)}
					>
						{backlogBusy.has(t.key) ? '📋…' : progressBusy.has(t.key) ? '진행 중…' : '진행'}
					</button>
					<svg
						className="rc-chev"
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="var(--muted)"
						strokeWidth="2"
						style={{ transform: level ? 'rotate(180deg)' : 'rotate(0)' }}
					>
						<path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</div>
				{level >= 1 && (
					<div className="rc-detail" onClick={(e) => e.stopPropagation()}>
						{/* 티켓 + 전체 메타 + 컨트롤 */}
						<div className="rcd-idrow">
							<code className="rcd-ticket">{t.ticket || '📌 티켓 없음'}</code>
							{(metaText || surface) && (
								<span className="rcd-fullmeta">
									{metaText}
									{surface ? `${metaText ? ' · ' : ''}${surface.toUpperCase()}` : ''}
								</span>
							)}
							<span className="rc-gap" />
							<button
								className={`rcd-classbtn ${t.taskClass || 'pending'}`}
								onClick={() => setClassModal(t)}
								title="개발/비개발 분류 — 클릭해 변경"
							>
								{t.taskClass
									? `${CLASS_META[t.taskClass].icon} ${CLASS_META[t.taskClass].label}`
									: '⏳ 분류'}
							</button>
							<select
								className="rcd-sel"
								value={t.devModel || ''}
								onChange={(e) => setTaskModelOf(t.key, e.target.value || null)}
								title="▶진행 시 쓸 모델 (기본 opus)"
							>
								<option value="">🤖 자동·opus</option>
								<option value="claude-opus-4-8">opus</option>
								<option value="claude-sonnet-4-6">sonnet</option>
								<option value="claude-haiku-4-5">haiku</option>
							</select>
							<select
								className="rcd-sel"
								value={t.devServer || ''}
								onChange={(e) => setDevServerOf(t.key, e.target.value || null)}
								title="이 업무가 배포된 dev 서버"
							>
								<option value="">🚀 배포 dev?</option>
								{[1, 2, 3, 4, 5, 6].map((n) => (
									<option key={n} value={`dev${n}`}>
										dev{n}
									</option>
								))}
							</select>
							{t.devServer && (
								<button
									className="mini-dev"
									title={`배포 ${t.devServer} 화면 보기`}
									onClick={() => navigate(`/command?dev=${t.devServer!.replace('dev', '')}`)}
								>
									🚀{t.devServer.replace('dev', '')}
								</button>
							)}
							{devPort && (
								<button
									className="mini-dbg"
									title={`디버깅 :${devPort} 보기`}
									onClick={() => navigate(`/command?port=${devPort}`)}
								>
									🐞
								</button>
							)}
							{t.noWorktree && (
								<span className="rcd-nowt" title="로컬 워크트리 없음 (PR만 존재)">
									워크트리 없음
								</span>
							)}
						</div>
						{t.summary && <p className="rcd-desc">{t.summary}</p>}
						{t.taskClass === 'ops' && (
							<div className={`ops-box${t.opsResult?.needsHuman ? ' needs-human' : ''}`}>
								{t.opsRunning ? (
									<span className="ops-line">
										⏳ 비개발 처리 중… (노션 정리·문서·리서치) — 상단 진행바
									</span>
								) : t.opsResult ? (
									<>
										<div className="ops-line">
											{t.opsResult.needsHuman ? '🙋 확인 필요' : '✅ 처리됨'} ·{' '}
											{t.opsResult.summary}
										</div>
										{!!t.opsResult.artifacts?.length && (
											<div className="ops-arts">
												{t.opsResult.artifacts!.map((u, i) => (
													<a key={i} href={u} target="_blank" rel="noreferrer">
														🔗 결과{t.opsResult!.artifacts!.length > 1 ? ` ${i + 1}` : ''}
													</a>
												))}
											</div>
										)}
										{t.opsResult.needsHuman && t.opsResult.ask && (
											<div className="ops-ask">❓ {t.opsResult.ask}</div>
										)}
										<button className="ops-btn" onClick={() => startOpsOf(t.key)}>
											🔄 다시 처리
										</button>
									</>
								) : (
									<button className="ops-btn go" onClick={() => startOpsOf(t.key)}>
										▶ 비개발 처리 (노션 정리·문서·리서치)
									</button>
								)}
							</div>
						)}
						{/* 에이전트/워크트리 행 */}
						{agents.length > 0 && (
							<div className="rcd-agents">
								{agents.map((tm) => {
									const st = agentStat(tm)
									const open = openTerms.has(tm.name)
									const adot =
										st.c === 'work'
											? 'var(--green)'
											: st.c === 'wait'
											? 'var(--yellow)'
											: st.c === 'auth'
											? 'var(--red)'
											: 'var(--muted)'
									const stLabel =
										st.c === 'work'
											? '진행중'
											: st.c === 'wait'
											? '질문 대기'
											: st.c === 'auth'
											? '인증 필요'
											: '대기'
									return (
										<div className="rcd-agent" key={tm.name}>
											<div className="rcd-agent-row">
												<span
													className="rcd-adot"
													style={{
														background: adot,
														animation:
															st.c === 'work'
																? 'pulseDot 1.8s ease-in-out infinite'
																: 'none',
													}}
												/>
												<span className="rcd-ast" style={{ color: adot }}>
													{stLabel}
												</span>
												<span className="rcd-abranch">{tm.label}</span>
												{tm.status?.tail && !open && (
													<span className="rcd-alog">{tm.status.tail}</span>
												)}
												<span className="rc-gap" />
												<button className="rcd-abtn" onClick={() => toggleTerm(tm.name)}>
													{open ? '접기' : '터미널'}
												</button>
												<button
													className="rcd-abtn"
													onClick={() => killTerm(tm.name)}
													title="에이전트 종료(tmux 세션 kill)"
												>
													종료
												</button>
											</div>
											{open && (
												<div className="ta-term">
													<XTerm session={tm.name} cwd={tm.cwd} />
												</div>
											)}
										</div>
									)
								})}
							</div>
						)}
						{/* 브랜치별 영역 — 한 작업의 여러 브랜치/PR을 각각 (워크트리+PR) 묶어 독립 테스트 */}
						{branchGroups(t).length > 0 ? (
							<div className="rcd-branches">
								{(() => {
									const bg = branchGroups(t)
									return bg.map((g, i) => branchSection(g, i, bg.length, t))
								})()}
							</div>
						) : agents[0]?.cwd ? (
							<div className="rcd-branches">
								<div className="rcd-branch">
									<div className="rcd-branch-head">
										<span className="rcd-branch-name" title={agents[0]!.cwd}>
											⑂ {agents[0]!.label}
										</span>
									</div>
									<div className="rcd-branch-ctl">
										<button
											className="ck-chip devstart"
											onClick={() =>
												startDevServer({ path: agents[0]!.cwd!, ticket: t.ticket, name: t.key })
											}
											title="개발서버 켜기 + 디버깅으로"
										>
											▶ dev
										</button>
										<a
											className="ck-chip vscode"
											href={`vscode://file${encodeURI(agents[0]!.cwd!)}`}
											title={`VSCode — ${agents[0]!.cwd}`}
										>
											🆚 VSCode
										</a>
									</div>
								</div>
							</div>
						) : null}
						{/* 링크 칩 (dc) */}
						<div className="rcd-links">
							{LINK_ROWS.flatMap(({ kind, icon, label }) =>
								t.links[kind].length
									? t.links[kind].map((u) => (
											<a
												key={u}
												className="rcd-chip"
												href={u}
												target="_blank"
												rel="noreferrer"
												title={kind === 'notion' ? notionLabel(u) + ' — ' + u : u}
											>
												{icon} {kind === 'notion' ? notionLabel(u) : label}
												<span
													className="rcd-chip-x"
													title="링크 제거"
													onClick={(e) => {
														e.preventDefault()
														removeLink(t.key, kind, u)
													}}
												>
													✕
												</span>
											</a>
									  ))
									: [
											<button
												key={kind}
												className="rcd-chip ghost"
												onClick={() => {
													setAddLinkFor(t.key)
													setAddLinkUrl('')
												}}
											>
												{icon} {label}
											</button>,
									  ]
							)}
							{addLinkFor === t.key ? (
								<input
									className="rcd-linkinput"
									autoFocus
									placeholder="링크 붙여넣기 (slack/notion/figma)"
									value={addLinkUrl}
									onChange={(e) => setAddLinkUrl(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') addLink(t.key, addLinkUrl)
										if (e.key === 'Escape') setAddLinkFor(null)
									}}
									onBlur={() => setAddLinkFor(null)}
								/>
							) : (
								<button
									className="rcd-addlink"
									onClick={() => {
										setAddLinkFor(t.key)
										setAddLinkUrl('')
									}}
								>
									＋ 링크
								</button>
							)}
						</div>
						{/* 메모 */}
						<textarea
							className="rcd-memo"
							placeholder="메모… (포커스 해제 시 저장)"
							defaultValue={t.memo || ''}
							onBlur={(e) => {
								if ((e.target.value || '') !== (t.memo || '')) setMemoOf(t.key, e.target.value)
							}}
						/>
					</div>
				)}
			</div>
		)
	}

	const sm = cockpit?.summary
	const cmuxByWs: Record<string, CmuxSession[]> = {}
	for (const s of cmux) (cmuxByWs[s.workspace || '(기타)'] = cmuxByWs[s.workspace || '(기타)'] || []).push(s)

	return (
		<>
			{(() => {
				const inProg = (tasks || []).filter(isInProgress)
				if (inProg.length + justCompleted.length + justWaiting.length === 0) return null
				// 진행중을 그룹별로 묶기 (작업 영역과 동일 그룹 기준)
				const inProgByGroup = (() => {
					const m = new Map<string, WorkItem[]>()
					for (const t of inProg) {
						const g = t.group || '분류 안 됨'
						if (!m.has(g)) m.set(g, [])
						m.get(g)!.push(t)
					}
					return [...m.entries()]
				})()
				if (!progDockOpen)
					return (
						<button
							className={`prog-tab ${justWaiting.length ? 'has-wait' : justCompleted.length ? 'has-done' : ''}`}
							onClick={() => setProgDockOpen(true)}
							title="진행 현황 열기"
						>
							{justWaiting.length
								? `💬 ${justWaiting.length}`
								: justCompleted.length
								? `✅ ${justCompleted.length}`
								: `🔵 ${inProg.length}`}
						</button>
					)
				return (
					<div className="prog-dock">
						<div
							className="pd-head"
							onClick={() => setProgDockOpen(false)}
							title="헤더 클릭해 접기"
							style={{ cursor: 'pointer' }}
						>
							<span className="pd-title">📋 진행 현황</span>
							<span className="rc-gap" />
							<button className="pd-collapse" title="접기">
								›
							</button>
						</div>
						<div className="pd-body">
							{justWaiting.length > 0 && (
								<div className="pd-sec wait">
									<div className="pd-sec-head">
										💬 질문 대기 · 확인 {justWaiting.length}
										<span className="rc-gap" />
										<button className="pd-ackall" onClick={() => setJustWaiting([])}>
											모두 확인
										</button>
									</div>
									{justWaiting.map((c) => (
										<div className="pd-item wait" key={c.key}>
											<span className="pd-dot" style={{ background: 'var(--yellow)' }} title="질문 대기" />
											<span className="pd-item-title" title={c.title} onClick={() => scrollToTask(c.key)}>
												{c.title}
											</span>
											<button className="pd-ack pd-ack-wait" onClick={() => ackWait(c.key)} title="확인 처리">
												확인
											</button>
										</div>
									))}
								</div>
							)}
							{justCompleted.length > 0 && (
								<div className="pd-sec done">
									<div className="pd-sec-head">
										✅ 완료 · 확인 {justCompleted.length}
										<span className="rc-gap" />
										<button className="pd-ackall" onClick={() => setJustCompleted([])}>
											모두 확인
										</button>
									</div>
									{justCompleted.map((c) => (
										<div className="pd-item done" key={c.key}>
											<span
												className="pd-dot"
												style={{ background: 'var(--green)' }}
												title="완료"
											/>
											<span
												className="pd-item-title"
												title={c.title}
												onClick={() => {
													scrollToTask(c.key)
													ackDone(c.key)
												}}
											>
												{c.title}
											</span>
											<button className="pd-ack" onClick={() => ackDone(c.key)} title="확인 처리">
												확인
											</button>
										</div>
									))}
								</div>
							)}
							<div className="pd-sec">
								<div className="pd-sec-head">🔵 진행중 {inProg.length}</div>
								{inProg.length ? (
									inProgByGroup.map(([g, items]) => (
										<div className="pd-group" key={g}>
											<div className="pd-group-label">
												📁 {g}
												<span className="pd-group-n">{items.length}</span>
											</div>
											{items.map((t) => {
												const st = progressStatus(t)
												return (
													<div
														className="pd-item"
														key={t.key}
														onClick={() => scrollToTask(t.key)}
													>
														<span
															className="pd-dot"
															style={{ background: st.color }}
															title={st.label}
														/>
														<span className="pd-item-title" title={t.title}>
															{t.title}
														</span>
													</div>
												)
											})}
										</div>
									))
								) : (
									<div className="pd-empty">진행중 없음</div>
								)}
							</div>
						</div>
					</div>
				)
			})()}

			{/* ⚠️ 실패한 추출/백로그 — 오른쪽 도크(개발실에서 바로 재시도). 입력 보존돼 재입력 불필요. */}
			{failures.length > 0 &&
				(failDockOpen ? (
					<div className="fail-dock">
						<div className="fd-head">
							<span className="fd-title-h">⚠️ 생성 실패 {failures.length}</span>
							<button className="fd-collapse" onClick={() => setFailDockOpen(false)} title="접기">
								›
							</button>
						</div>
						<div className="fd-body">
							{failures.map((f) => (
								<div className="fd-item" key={f.id}>
									<div className="fd-item-top">
										<span className="jf-kind">
											{f.kind === 'enrich'
												? '✨ 추출'
												: f.kind === 'backlog'
												? '📋 백로그'
												: f.kind}
										</span>
										<span className="rc-gap" />
										<button
											className="fd-x"
											onClick={() => dismissFailure(f.id)}
											title="목록에서 제거"
										>
											✕
										</button>
									</div>
									<div className="fd-item-title" title={f.title}>
										{f.title}
									</div>
									<div className="fd-item-err" title={f.error}>
										{f.error}
									</div>
									<button
										className="ck-chip rvw fd-retry"
										onClick={() => retryFailure(f.id)}
										title="보존된 입력으로 다시 시작"
									>
										🔄 재시도
									</button>
								</div>
							))}
						</div>
					</div>
				) : (
					<button
						className="fail-tab"
						onClick={() => setFailDockOpen(true)}
						title={`생성 실패 ${failures.length}건 — 열어서 재시도`}
					>
						⚠️ {failures.length}
					</button>
				))}

			{/* 🔎 PR 리뷰 결과 모달 — 리뷰 끝나면 자동 오픈 + 칩 클릭으로 열기 */}
			{reviewModal && (
				<div className="rvm-backdrop" onClick={() => setReviewModal(null)}>
					<div className="rvm" onClick={(e) => e.stopPropagation()}>
						<div className="rvm-head">
							<span className={`rvw-verdict ${reviewModal.review.verdict || 'comment'}`}>
								{reviewModal.review.verdict === 'approve'
									? '✅ approve'
									: reviewModal.review.verdict === 'request_changes'
									? '⚠️ 변경요청'
									: '💬 comment'}
							</span>
							<span className="rvm-title" title={reviewModal.title}>
								🔎 #{reviewModal.prNum} 리뷰 · {reviewModal.title}
							</span>
							<span className="rc-gap" />
							<button className="rvm-x" onClick={() => setReviewModal(null)} title="닫기">
								✕
							</button>
						</div>
						<p className="rvm-summary">{reviewModal.review.summary}</p>
						{reviewModal.review.issues.length ? (
							<ul className="rvw-issues rvm-issues">
								{reviewModal.review.issues.map((is, k) => (
									<li key={k} className={`rvw-issue sev-${is.severity}`}>
										<span className="rvw-sev">{is.severity}</span>
										<span className="rvw-title">{is.title}</span>
										{is.file && (
											<span className="rvw-loc">
												{is.file}
												{is.line ? ':' + is.line : ''}
											</span>
										)}
										{is.detail && <div className="rvw-detail">{is.detail}</div>}
										{is.fix && <div className="rvw-fix">💡 {is.fix}</div>}
									</li>
								))}
							</ul>
						) : (
							<div className="rvw-clean">지적 사항 없음 ✨ — 코드 문제 없음</div>
						)}
						{reviewModal.improved && (
							<div className="rvw-improved">
								🔧 개선됨: {reviewModal.improved.summary}
								{reviewModal.improved.pushed ? ' (푸시됨)' : ''}
							</div>
						)}
						{reviewModal.question && (
							<div className="rvw-question">
								<div className="rvq-q">🗣️ {reviewModal.question.question}</div>
								<div className="rvq-a">
									💬 {reviewModal.question.answer}
									{reviewModal.question.verdictChanged ? ' (판정 변경됨)' : ''}
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* 🗣️ 리뷰 항의/질문 입력 모달 */}
			{questionModal && (
				<div
					className="rvm-backdrop"
					onClick={() => {
						setQuestionModal(null)
						setQuestionText('')
					}}
				>
					<div className="rvm" onClick={(e) => e.stopPropagation()}>
						<div className="rvm-head">
							<span className="rvm-title" title={questionModal.title}>
								🗣️ #{questionModal.prNum} 리뷰 항의 · {questionModal.title}
							</span>
							<span className="rc-gap" />
							<button
								className="rvm-x"
								onClick={() => {
									setQuestionModal(null)
									setQuestionText('')
								}}
								title="닫기"
							>
								✕
							</button>
						</div>
						<textarea
							className="rvq-textarea"
							placeholder="리뷰 판정에 대한 반박이나 질문을 적어주세요. 예: P2 이슈 2번은 이미 별도 티켓으로 처리 중인데요?"
							value={questionText}
							onChange={(e) => setQuestionText(e.target.value)}
							rows={5}
							autoFocus
						/>
						<div className="rvq-actions">
							<button
								className="ck-chip ghost"
								onClick={() => {
									setQuestionModal(null)
									setQuestionText('')
								}}
							>
								취소
							</button>
							<button className="ck-chip imp" disabled={!questionText.trim()} onClick={askPrQuestion}>
								보내기
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 리디자인: 앰비언트 상단 스트립 — 조용히, 부하만 필요할 때 강조 */}
			<div className="dev-strip">
				<div className="ds-title">
					<span className="ds-name">개발실</span>
					<span className="ds-sub">병렬 개발 콕핏</span>
				</div>
				<span className="ds-live">
					<span className="ds-live-dot" />
					실시간
				</span>
				<div className="ds-spacer" />
				<div className="density-seg" title="카드 밀도">
					<button
						className={density === 'comfortable' ? 'on' : ''}
						onClick={() => setDensityMode('comfortable')}
					>
						넉넉
					</button>
					<button className={density === 'compact' ? 'on' : ''} onClick={() => setDensityMode('compact')}>
						조밀
					</button>
				</div>
				<span className="ds-counts">
					Claude {resources?.claude ?? 0} · dev {resources?.devServers ?? 0} · 터미널 {resources?.agents ?? 0}
				</span>
				{heavy && (
					<span className="ds-load">
						<span className="ds-load-dot" />
						부하 높음
					</span>
				)}
				<div className="ds-tools">
					<button
						className={`review-toggle ${reviewMode ? 'on' : ''}`}
						onClick={toggleReviewMode}
						title={
							reviewMode
								? '리뷰 브리핑 ON — 에이전트가 왜·리스크·봐야 할 곳·검증을 설득 브리핑으로 마무리 (끄면 빠른 진행)'
								: '리뷰 브리핑 OFF — 빠른 진행만 (켜면 리뷰어 설득 브리핑)'
						}
					>
						{reviewMode ? '🧑‍⚖️ 리뷰 브리핑' : '⚡ 빠른 진행'}
					</button>
					<button
						className={`notify-toggle ${agentNotify ? 'on' : ''}`}
						onClick={toggleAgentNotify}
						title={agentNotify ? '에이전트 알림 ON — 완료·질문·인증 시 맥 알림' : '에이전트 알림 OFF'}
					>
						{agentNotify ? '🔔' : '🔕'}
					</button>
					<button
						className={`fable-toggle ${fableLock ? 'locked' : ''}`}
						onClick={toggleFableLock}
						title={
							fableLock
								? 'Fable 잠금 ON — 지휘·설계도 opus로 (비용 차단)'
								: 'Fable 잠금 OFF — 지휘·설계는 fable'
						}
					>
						{fableLock ? '🔒 Fable' : '🔓 Fable'}
					</button>
					<button
						className={`btn-send ${launcherOpen ? 'on' : ''}`}
						onClick={() => setLauncherOpen((o) => !o)}
					>
						{launcherOpen ? '✕ 닫기' : '＋ 새 작업'}
					</button>
				</div>
			</div>

			{/* ＋새 작업 런처 — 티켓/브랜치 → 워크트리 자동 생성 → claude + 초기 지시 주입 */}
			{launcherOpen && (
				<div className="task-launcher">
					<div className="tl-row">
						<label className="tl-field grow">
							<span className="tl-lbl">티켓 / 브랜치명</span>
							<input
								className="tl-input"
								placeholder="예: PROJ-1234-popup-fix 또는 1234"
								value={taskTicket}
								autoFocus
								onChange={(e) => setTaskTicket(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) startTask()
								}}
								disabled={taskBusy}
							/>
						</label>
						<label className="tl-field">
							<span className="tl-lbl">베이스</span>
							<input
								className="tl-input"
								style={{ width: 130 }}
								value={taskBase}
								onChange={(e) => setTaskBase(e.target.value)}
								disabled={taskBusy}
							/>
						</label>
					</div>
					<label className="tl-field">
						<span className="tl-lbl">초기 지시 (선택) — claude에게 바로 전달</span>
						<textarea
							className="tl-input tl-seed"
							rows={2}
							placeholder='예: "팝업 타깃 노출 조건 버그 고쳐줘. 관련 파일 먼저 찾아보고 계획부터 알려줘."'
							value={taskSeed}
							onChange={(e) => setTaskSeed(e.target.value)}
							disabled={taskBusy}
						/>
					</label>
					<div className="tl-actions">
						<span className="muted tl-hint">
							→ <code>git worktree add</code> 로 <code>at-…</code> 폴더 생성 후 그 안에서{' '}
							<code>claude</code> 실행. (베이스에서 새 브랜치 분기, 이미 있으면 attach)
						</span>
						<button
							className="btn-send"
							onClick={() => startTask()}
							disabled={taskBusy || !taskTicket.trim()}
						>
							{taskBusy ? '시작 중…' : '▶ 작업 시작'}
						</button>
					</div>
					{taskMsg && <div className={`am-msg ${taskMsg.ok ? 'ok' : 'err'}`}>{taskMsg.text}</div>}
				</div>
			)}
			{taskMsg && !launcherOpen && (
				<div className={`am-msg ${taskMsg.ok ? 'ok' : 'err'}`} style={{ margin: '0 0 12px' }}>
					{taskMsg.text}
				</div>
			)}

			{/* 🔄 재부팅 복원 — MRM이 띄웠던 세션 중 지금 안 떠있는 것 */}
			{restorables.length > 0 && (
				<div className="restore-banner">
					<div className="rb-head">
						🔄 <b>복원 가능한 세션 {restorables.length}개</b>
						<span className="muted">
							— 재부팅/종료로 사라진 dev 서버·에이전트. dev는 재시작, 에이전트는{' '}
							<code>claude --continue</code>로 직전 대화를 이어받습니다.
						</span>
					</div>
					<div className="rb-actions">
						{restorables.some((r) => r.kind === 'dev' && r.dirExists) && (
							<button
								className="btn-send"
								disabled={restoreBusy}
								onClick={() => restoreSessions({ kind: 'dev' })}
							>
								🖥️ dev 서버 {restorables.filter((r) => r.kind === 'dev' && r.dirExists).length}개 재시작
							</button>
						)}
						<button
							className="btn-dry"
							disabled={restoreBusy}
							onClick={() => restoreSessions({ all: true })}
						>
							{restoreBusy ? '복원 중…' : '↻ 전체 복원'}
						</button>
						<button
							className="btn-dry"
							onClick={() => forgetRestorable({ all: true })}
							title="복원 목록 비우기"
						>
							✕ 무시
						</button>
					</div>
					<div className="rb-list">
						{restorables.map((r) => (
							<div className="rb-item" key={r.name}>
								<span className={`rb-kind rbk-${r.kind}`}>
									{r.kind === 'dev' ? '🖥️ dev' : r.kind === 'agent' ? '🤖 에이전트' : '셸'}
								</span>
								<span className="rb-label">{r.label || r.name}</span>
								{!r.dirExists && (
									<span className="rb-gone" title={r.cwd}>
										워크트리 없음
									</span>
								)}
								<button
									className="rb-btn"
									disabled={restoreBusy || !r.dirExists}
									onClick={() => restoreSessions({ name: r.name })}
								>
									복원
								</button>
								<button
									className="rb-btn ghost"
									onClick={() => forgetRestorable({ name: r.name })}
									title="이 항목 무시"
								>
									✕
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			{/* 요약 접기 토글 (+ 접힘 시 핵심만 한 줄) — 업무 보드 집중용 */}
			<div className="ck-head">
				<button
					className="ck-toggle"
					onClick={toggleCockpit}
					title={cockpitOpen ? '요약 접기 — 업무 보드에 집중' : '요약 펼치기'}
				>
					{cockpitOpen ? '▾ 요약' : '▸ 요약'}
				</button>
				{!cockpitOpen && (
					<span className="ck-mini">
						<span>🌿 {sm?.streamsActive ?? '–'}</span>
						<span className={sm?.dirty ? 'warnv' : ''}>📝 {sm?.dirty ?? '–'}</span>
						<span>
							🔀 {sm?.prOpen ?? '–'}
							{sm?.prDraft ? `+${sm.prDraft}` : ''}
						</span>
						<span>
							{sm?.ciFail ? <b className="badv">❌ CI {sm.ciFail}</b> : <span className="okv">✓ CI</span>}
						</span>
						{cockpit?.devServers.map((d) => (
							<a
								key={d.port}
								href={`http://localhost:${d.port}`}
								target="_blank"
								rel="noreferrer"
								className="ck-mini-dev"
								title={d.cwd}
							>
								<code>:{d.port}</code>
							</a>
						))}
						{cockpit?.now?.focused?.ticket && (
							<span className="ck-mini-now">🔥 {cockpit.now.focused.ticket}</span>
						)}
					</span>
				)}
			</div>

			{/* 🔥 지금 작업 중 — 자동 감지(최근 만진 파일 mtime + cmux 포커스) */}
			{cockpitOpen && cockpit?.now && (cockpit.now.recent.length > 0 || cockpit.now.focused) && (
				<div className="now-bar">
					<span className="now-label">🔥 지금</span>
					{cockpit.now.focused &&
						(cockpit.now.focused.ticket ||
							(cockpit.now.focused.name && cockpit.now.focused.name !== 'unknown')) && (
							<span className="now-focus" title={cockpit.now.focused.path}>
								👁 보는 중 <b>{cockpit.now.focused.ticket || cockpit.now.focused.name}</b>
							</span>
						)}
					<span className="now-sep">방금 만진:</span>
					<span className="now-recent">
						{cockpit.now.recent.slice(0, 4).map((r, i) => (
							<span key={i} className="now-chip" title={r.touchedFile || ''}>
								<b>{r.ticket || r.name}</b> <span className="now-ago">{ago(r.touchedMs)}</span>
								{r.dirty > 0 && <span className="now-dirty">●{r.dirty}</span>}
							</span>
						))}
					</span>
				</div>
			)}

			{/* ── 한눈 요약 스트립 (작업 지표 + dev 서버) — dev/터미널 수는 상단 ResourceBar에 있어 중복 제거 ── */}
			{cockpitOpen && (
				<div className="ck-strip">
					<div className="ck-kpis">
						<span className="ck-kpi">
							🌿 스트림 <b>{sm?.streamsActive ?? '–'}</b>
							<small>/{sm?.streamsTotal ?? cockpit?.streamsTotal ?? '–'}</small>
						</span>
						<span className="ck-kpi">
							📝 미커밋 <b className={sm?.dirty ? 'warnv' : ''}>{sm?.dirty ?? '–'}</b>
						</span>
						<span className="ck-kpi">
							🔀 PR <b>{sm?.prOpen ?? '–'}</b>
							{!!sm?.prDraft && <small>+{sm.prDraft} draft</small>}
						</span>
						{sm?.ciFail ? (
							<span className="ck-kpi">
								❌ CI <b className="badv">{sm.ciFail}</b>
							</span>
						) : (
							<span className="ck-kpi ok" title="CI 실패 없음">
								✓ CI
							</span>
						)}
					</div>
					<div className="ck-devs">
						{cockpit?.devServers.length ? (
							cockpit.devServers.map((d) => (
								<a
									key={d.port}
									className="ck-dev"
									href={`http://localhost:${d.port}`}
									target="_blank"
									rel="noreferrer"
									title={d.cwd}
								>
									<span className="dot up" /> {d.ticket || d.kind} <code>:{d.port}</code>
								</a>
							))
						) : (
							<span className="muted" style={{ fontSize: 11.5 }}>
								dev 서버 없음
							</span>
						)}
					</div>
				</div>
			)}

			{/* ── 업무 보드 — 업무(티켓) > 스레드 · 노션 · 피그마 · 작업 스트림 ── */}
			<h2 className="sec" style={{ cursor: 'pointer' }} onClick={() => setShowStreams((v) => !v)}>
				{showStreams ? '▾' : '▸'} 🗂️ 업무 <span className="muted">· {tasks?.length ?? 0}</span>
				{cockpit?.prError && (
					<span className="badv" style={{ fontSize: 11, marginLeft: 8 }}>
						PR 조회 실패
					</span>
				)}
			</h2>
			{showStreams && (
				<>
					{/* 링크로 업무 만들기 — 스레드/노션/피그마 붙여넣기 */}
					<div className="task-create">
						<textarea
							className="tl-input grow task-create-ta"
							rows={1}
							placeholder="링크(스레드·노션·피그마·PR) 또는 그냥 텍스트로 업무 생성 — 여러 줄이면 줄마다 1개씩 (Enter 생성 · Shift+Enter 줄바꿈 · 티켓번호 자동연결)"
							value={newLink}
							onChange={(e) => setNewLink(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault()
									createTask()
								}
							}}
							disabled={linkBusy}
						/>
						<button
							className="btn-send"
							onClick={enrichLink}
							disabled={enrichBusy || linkBusy || !newLink.trim()}
							title="스레드·노션·피그마 링크를 AI가 읽어 제목·요약·관련 링크(노션/피그마/스레드)까지 채운 일감 생성 (~30초)"
						>
							{enrichBusy ? '✨ 생성 중…' : '✨ 일감 생성'}
						</button>
						<button
							className="btn-dry"
							onClick={createTask}
							disabled={linkBusy || enrichBusy || !newLink.trim()}
							title="링크만 빠르게 붙여 업무 생성(즉시)"
						>
							{linkBusy ? '생성 중…' : '＋ 빠른 업무'}
						</button>
						{linkMsg && <span className="muted task-create-msg">{linkMsg}</span>}
					</div>

					{tasks === null ? (
						<PageSkeleton board />
					) : tasks.length === 0 ? (
						<p className="muted">
							업무가 없습니다 — 위에 링크를 붙여넣어 만들거나, 상단 ＋새 작업으로 워크트리를 시작하세요.
						</p>
					) : (
						<div className="task-groups">
							<div className="task-groups-bar">
								<button className="btn-dry" onClick={addGroup}>
									＋ 그룹
								</button>
								<span className="muted" style={{ fontSize: 11.5 }}>
									업무 카드를 드래그(⠿)해 그룹에 넣어 분류하세요
								</span>
							</div>
							{(() => {
								const allGroups = [...taskGroups, null] as (string | null)[]
								const membersOf = (g: string | null) =>
									(tasks || []).filter((t) => (t.group || null) === g && !taskDone(t))
								const doneMembersOf = (g: string | null) =>
									(tasks || []).filter((t) => (t.group || null) === g && taskDone(t)) // 그 그룹의 완료 카드
								const isOpen = (g: string | null) => openGroups.has(g ?? '__none__')
								const closedGroups = allGroups.filter(
									(g) => !isOpen(g) && !(g === null && membersOf(null).length === 0)
								)
								// 열린 그룹은 "연 순서"대로 표시 (openGroups Set 삽입 순서) — 데이터 갱신에도 자리 안 바뀜
								const validGid = (gid: string) => gid === '__none__' || taskGroups.includes(gid)
								const openList = [...openGroups]
									.filter(validGid)
									.map((gid) => (gid === '__none__' ? null : gid)) as (string | null)[]
								// 그룹명(편집 가능) — 닫힘 행/열림 카드 공용. 더블클릭 → 인풋.
								const nameEl = (g: string | null, cls: string) =>
									renameGroup?.old === g && g != null ? (
										<input
											className="ws-name-input"
											autoFocus
											value={renameGroup.v}
											onClick={(e) => e.stopPropagation()}
											onChange={(e) => setRenameGroup({ old: g, v: e.target.value })}
											onKeyDown={(e) => {
												if (e.key === 'Enter') saveRename(g, renameGroup.v)
												if (e.key === 'Escape') setRenameGroup(null)
											}}
											onBlur={() => saveRename(g, renameGroup.v)}
										/>
									) : (
										<span
											className={cls}
											title={g != null ? '더블클릭해 이름 변경' : undefined}
											onDoubleClick={(e) => {
												if (g != null) {
													e.stopPropagation()
													setRenameGroup({ old: g, v: g })
												}
											}}
										>
											{g ?? '분류 안 됨'}
										</span>
									)
								const renderRow = (g: string | null) => {
									const gid = g ?? '__none__'
									const m = membersOf(g)
									return (
										<div
											key={gid}
											className={`stream-row ${dragOverGroup === gid ? 'dragover' : ''}`}
											onClick={() => toggleGroup(gid)}
											onDragOver={(e) => {
												e.preventDefault()
												if (dragOverGroup !== gid) setDragOverGroup(gid)
											}}
											onDragLeave={() => setDragOverGroup((d) => (d === gid ? null : d))}
											onDrop={(e) => {
												e.preventDefault()
												onDropToGroup(g)
											}}
										>
											<span className="sr-emoji">{g == null ? '📥' : '📁'}</span>
											{nameEl(g, 'sr-name')}
											{m.length > 0 && <span className="sr-count">{m.length}</span>}
											<span className="rc-gap" />
											{g != null && groupBases[g] && (
												<span className="sr-base">{groupBases[g]}</span>
											)}
											{g != null && (
												<button
													className="sr-del"
													title="그룹 삭제 (업무는 미분류로 이동)"
													onClick={(e) => {
														e.stopPropagation()
														delGroup(g)
													}}
												>
													✕
												</button>
											)}
											<svg
												className="sr-chev"
												width="15"
												height="15"
												viewBox="0 0 24 24"
												fill="none"
												stroke="var(--muted)"
												strokeWidth="2"
											>
												<path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
											</svg>
										</div>
									)
								}
								const renderOpen = (g: string | null) => {
									const gid = g ?? '__none__'
									const fMembers = membersOf(g)
									return (
										<div
											key={gid}
											className={`workspace-card ${dragOverGroup === gid ? 'dragover' : ''}`}
											onDragOver={(e) => {
												e.preventDefault()
												if (dragOverGroup !== gid) setDragOverGroup(gid)
											}}
											onDragLeave={() => setDragOverGroup((d) => (d === gid ? null : d))}
											onDrop={(e) => {
												e.preventDefault()
												onDropToGroup(g)
											}}
										>
											<div className="ws-head">
												<button
													className="ws-collapse"
													title="접기"
													onClick={() => toggleGroup(gid)}
												>
													<svg
														width="15"
														height="15"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
													>
														<path
															d="M6 9l6 6 6-6"
															strokeLinecap="round"
															strokeLinejoin="round"
														/>
													</svg>
												</button>
												<span className="ws-emoji">{g == null ? '📥' : '📁'}</span>
												{nameEl(g, 'ws-name')}
												<span className="ws-count">{fMembers.length}</span>
												<span className="rc-gap" />
												{g != null && groupBases[g] && (
													<span className="ws-deploy">🚀 {groupBases[g]}</span>
												)}
												{g != null && (
													<button
														className={`ws-settings ${settingsGroup === g ? 'on' : ''}`}
														onClick={() => setSettingsGroup((s) => (s === g ? null : g))}
													>
														⚙ 그룹 설정
													</button>
												)}
											</div>
											{g != null && settingsGroup === g && (
												<div className="ws-settings-row">
													{editBase?.g === g ? (
														<select
															className="tg-base-input"
															autoFocus
															value={editBase.v}
															onChange={(e) => {
																const v = e.target.value
																if (v === '__new__') {
																	setEditBase(null)
																	createBranchFor(g)
																	return
																}
																saveGroupBase(g, v)
															}}
															onBlur={() => setEditBase(null)}
														>
															<option value="">— 없음 (정리용 그룹) —</option>
															{groupBases[g] && !branches.includes(groupBases[g]) && (
																<option value={groupBases[g]}>{groupBases[g]}</option>
															)}
															{branches.map((b) => (
																<option key={b} value={b}>
																	{b}
																</option>
															))}
															<option value="__new__">＋ 새 브랜치 생성…</option>
														</select>
													) : (
														<button
															className={`tg-base ${groupBases[g] ? 'set' : ''}`}
															title="배포 base 브랜치 지정 — 이 그룹 PR의 타깃"
															onClick={() => {
																loadBranches()
																setEditBase({ g: g, v: groupBases[g] || '' })
															}}
														>
															🌿 {groupBases[g] || 'base'}
														</button>
													)}
													<button
														className={`tg-chain ${chainedGroups[g] ? 'on' : ''}`}
														title="🔗 체인 — 카드 순서대로 PR base를 앞 카드 브랜치로 연결"
														onClick={() => toggleChain(g)}
														disabled={chainBusy === g}
													>
														{chainBusy === g ? '🔗…' : chainedGroups[g] ? '🔗 체인' : '🔗'}
													</button>
													<button
														className="tg-groupdev"
														title="🌿 그룹 브랜치 개발서버 — 멤버 브랜치들을 병합한 통합 브랜치로 dev 서버 켜기"
														onClick={() => startGroupDev(g)}
														disabled={groupDevBusy === g}
													>
														{groupDevBusy === g ? '🌿…' : '🌿 그룹 개발서버'}
													</button>
													<button
														className={`tg-orch ${orchAll[g]?.active ? 'on' : ''} ${
															orchOpen.has(g) ? 'open' : ''
														}`}
														title="오케스트레이터 콘솔 (지휘자 투입)"
														onClick={() => toggleOrch(g)}
													>
														🎼
														{orchAll[g]?.active
															? ` 지휘 중${
																	orchAll[g]?.model
																		? '·' + modelTag(orchAll[g]!.model)
																		: ''
															  }`
															: ''}
													</button>
													<button
														className="tg-dev"
														title="이 그룹 자동 진행"
														onClick={() => autoGroup(fMembers)}
													>
														🎯 자동 진행
													</button>
													<button
														className="tg-qa"
														title="이 그룹 QA TC만 일괄"
														onClick={() => qaGroup(fMembers)}
													>
														🧪 QA만
													</button>
													<button
														className="tg-e2e"
														title="이 그룹 E2E만"
														onClick={() => e2eGroup(fMembers)}
													>
														🎭 E2E만
													</button>
													<button
														className="tg-del"
														title="그룹 삭제 (업무는 미분류로)"
														onClick={() => delGroup(g)}
													>
														✕ 그룹 삭제
													</button>
												</div>
											)}
											{g != null && orchOpen.has(g) && (
												<ConductorConsole
													group={g}
													members={fMembers}
													terms={terms}
													openTerms={openTerms}
													onToggleTerm={toggleTerm}
												/>
											)}
											{fMembers.length ? (
												PR_SECTIONS.map((sec) => {
													const items = fMembers
														.filter((m) => prBucket(m) === sec.key)
														.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
													if (!items.length) return null
													// '머지됨' 섹션은 압축 대상 — 헤더 클릭으로 토글, 기본 접힘
													const collapsible = sec.key === 'merged'
													const secOpen = !collapsible || mergedOpen.has(gid)
													return (
														<div key={sec.key} className="ws-section">
															<div
																className={`ws-sec-head ${
																	collapsible ? 'clickable' : ''
																}`}
																onClick={
																	collapsible ? () => toggleMerged(gid) : undefined
																}
															>
																{collapsible && (
																	<svg
																		className="ws-sec-chev"
																		width="12"
																		height="12"
																		viewBox="0 0 24 24"
																		fill="none"
																		stroke="currentColor"
																		strokeWidth="2"
																		style={{
																			transform: secOpen
																				? 'rotate(90deg)'
																				: 'rotate(0)',
																			transition: 'transform .15s',
																		}}
																	>
																		<path
																			d="M9 6l6 6-6 6"
																			strokeLinecap="round"
																			strokeLinejoin="round"
																		/>
																	</svg>
																)}
																<span
																	className="ws-sec-dot"
																	style={{ background: sec.dot }}
																/>
																<span className="ws-sec-label">{sec.label}</span>
																<span className="ws-sec-count">{items.length}</span>
																{collapsible && !secOpen && (
																	<span className="ws-sec-hint">눌러서 펼치기</span>
																)}
																<span className="ws-sec-line" />
															</div>
															{secOpen && (
																<div className="ws-cards">{items.map(renderCard)}</div>
															)}
														</div>
													)
												})
											) : (
												<p className="ws-emptyhint">여기로 업무를 드래그해 넣으세요</p>
											)}
											{(() => {
												const dm = doneMembersOf(g)
												if (!dm.length) return null
												const dopen = doneOpenGroups.has(gid)
												return (
													<div className="ws-section ws-done-sec">
														<div
															className="ws-sec-head clickable"
															onClick={() => toggleDoneGroup(gid)}
														>
															<svg
																className="ws-sec-chev"
																width="12"
																height="12"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																strokeWidth="2"
																style={{
																	transform: dopen ? 'rotate(90deg)' : 'rotate(0)',
																	transition: 'transform .15s',
																}}
															>
																<path
																	d="M9 6l6 6-6 6"
																	strokeLinecap="round"
																	strokeLinejoin="round"
																/>
															</svg>
															<span
																className="ws-sec-dot"
																style={{ background: 'var(--green)' }}
															/>
															<span className="ws-sec-label">✅ 완료</span>
															<span className="ws-sec-count">{dm.length}</span>
															{!dopen && (
																<span className="ws-sec-hint">눌러서 펼치기</span>
															)}
															<span className="ws-sec-line" />
															<button
																className="tg-cleanup"
																disabled={cleanupBusy === gid}
																onClick={(e) => {
																	e.stopPropagation()
																	runCleanupDone(dm.length, g, gid)
																}}
																title="이 그룹의 완료 작업 정리 (워크트리·브랜치·등록 — PR은 머지됨)"
															>
																{cleanupBusy === gid ? '정리 중…' : '🧹 ' + dm.length}
															</button>
														</div>
														{dopen && <div className="ws-cards">{dm.map(renderCard)}</div>}
													</div>
												)
											})()}
										</div>
									)
								}
								return (
									<>
										{closedGroups.length > 0 && (
											<div className="stream-rows">{closedGroups.map(renderRow)}</div>
										)}
										{openList.length > 0 ? (
											openList.map(renderOpen)
										) : (
											<p className="ws-emptyhint" style={{ padding: '18px 4px' }}>
												위 그룹을 클릭해 펼치세요 (여러 개 동시에 열 수 있음)
											</p>
										)}
										{/* 📦 보관함 — 해결한 작업을 날짜별 이력으로 보존 */}
										{archived.length > 0 && (
											<div className="arch-box">
												<div className="done-row" onClick={() => setArchivedOpen((v) => !v)}>
													<svg
														width="14"
														height="14"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
														style={{
															transform: archivedOpen ? 'rotate(90deg)' : 'rotate(0)',
															transition: 'transform .15s',
														}}
													>
														<path
															d="M9 6l6 6-6 6"
															strokeLinecap="round"
															strokeLinejoin="round"
														/>
													</svg>
													<span className="done-label">
														📦 보관함 (해결 이력){' '}
														{archived.reduce((n, d) => n + d.items.length, 0)}
													</span>
												</div>
												{archivedOpen &&
													archived.map((day) => (
														<div className="arch-day" key={day.date}>
															<div className="arch-day-head">
																<span className="arch-date">{day.date}</span>
																<span className="arch-day-count">
																	{day.items.length}건
																</span>
															</div>
															{day.items.map((a) => (
																<div className="arch-item" key={a.key}>
																	<span
																		className="arch-item-title"
																		title={a.title || a.ticket || a.key}
																	>
																		{a.ticket ? `[${a.ticket}] ` : ''}
																		{a.title || a.key}
																	</span>
																	{a.group && (
																		<span className="arch-chip">{a.group}</span>
																	)}
																	{(a.prs || []).slice(0, 3).map((p) => (
																		<a
																			key={p.number}
																			className="arch-pr"
																			href={p.url}
																			target="_blank"
																			rel="noreferrer"
																			title={`${p.repo}#${p.number}`}
																		>
																			#{p.number}
																		</a>
																	))}
																	<span className="rc-gap" />
																	<button
																		className="arch-btn"
																		onClick={() => unarchiveTask(a.key)}
																		title="보드로 복원 (수동 등록으로 되살림)"
																	>
																		↩︎ 복원
																	</button>
																	<button
																		className="arch-btn del"
																		onClick={() => removeArchived(a.key)}
																		title="이력에서 영구 삭제"
																	>
																		🗑
																	</button>
																</div>
															))}
														</div>
													))}
											</div>
										)}
									</>
								)
							})()}
						</div>
					)}
				</>
			)}

			{/* ── 기타 터미널 (업무에 안 묶인 빠른 터미널·cmux 인수) — 업무 에이전트는 카드 안에 ── */}
			<h2 className="sec" style={{ marginTop: 24 }}>
				🖥️ 기타 터미널 <span className="muted">· {otherTerms.length}</span>
				<span className="badge-real">실시간</span>
				{focus && (
					<button className="btn-dry" style={{ marginLeft: 8 }} onClick={() => setFocus(null)}>
						◧ 포커스 해제
					</button>
				)}
				<span className="term-quick">
					<select className="sel" value={newCwd} onChange={(e) => setNewCwd(e.target.value)}>
						<option value="">빠른 터미널 — 워크트리…</option>
						{cockpit?.active.map((s) => (
							<option key={s.path} value={s.path}>
								{s.ticket || s.name} ({s.branch})
							</option>
						))}
					</select>
					<select
						className="sel"
						value={newCmd}
						onChange={(e) => setNewCmd(e.target.value)}
						style={{ maxWidth: 110 }}
					>
						<option value="claude">claude</option>
						<option value="zsh">셸(zsh)</option>
						<option value="">빈 셸</option>
					</select>
					<button
						className="btn-dry"
						disabled={!newCwd}
						onClick={() => {
							const s = cockpit?.active.find((x) => x.path === newCwd)
							createTerm(newCwd, newCmd, s?.ticket || s?.name)
							setNewCwd('')
						}}
					>
						＋
					</button>
				</span>
			</h2>
			{otherTerms.length === 0 && (
				<p className="muted">
					업무에 묶이지 않은 터미널이 없습니다. (업무 카드의 <b>▶ 진행</b>으로 띄운 에이전트는 그 카드 안에
					있습니다.)
				</p>
			)}
			<div className={`agent-grid ${focus ? 'has-focus' : ''}`}>
				{otherTerms.map((t) => {
					const isOpen = openTerms.has(t.name)
					const isFocus = focus === t.name
					const s = t.status || {}
					const stat = s.needsAuth
						? { c: 'auth', t: '⚠️ 인증필요' }
						: s.working
						? { c: 'work', t: '⚙️ 작업중' }
						: s.waiting
						? { c: 'wait', t: '⏸ 입력대기' }
						: { c: 'idle', t: '⚪ 대기' }
					return (
						<div
							key={t.name}
							className={`agent-tile st-${stat.c} ${isFocus ? 'focus' : ''} ${isOpen ? 'open' : ''}`}
						>
							<div className="at-head">
								<span className={`at-badge ${stat.c}`}>{stat.t}</span>
								<span
									className="at-label"
									title={t.cwd}
									onClick={() => setFocus(isFocus ? null : t.name)}
								>
									{t.label}
								</span>
								<code className="at-cmd">{t.command}</code>
								{t.attached && <span className="mterm-att">● attached</span>}
								<span className="at-actions">
									<button
										className="btn-dry"
										onClick={() => setFocus(isFocus ? null : t.name)}
										title="전체폭으로 포커스"
									>
										{isFocus ? '◧' : '⛶'}
									</button>
									<button className="btn-dry" onClick={() => toggleTerm(t.name)}>
										{isOpen ? '접기' : '열기'}
									</button>
									<button className="btn-dry" onClick={() => killTerm(t.name)} title="세션 종료">
										✕
									</button>
								</span>
							</div>
							{!isOpen && s.tail && (
								<div className="at-tail" onClick={() => toggleTerm(t.name)} title="열기">
									{s.tail}
								</div>
							)}
							{isOpen && (
								<div className="at-body">
									<XTerm session={t.name} cwd={t.cwd} />
								</div>
							)}
						</div>
					)
				})}
			</div>

			{/* ── cmux 세션 (이름만 → MRM 터미널로 인수) ── */}
			<h2 className="sec" style={{ marginTop: 24 }}>
				📛 cmux 세션 <span className="muted">· {cmux.length}</span>
				<span className="cmux-note">이름만 — 클릭하면 같은 Claude 세션을 MRM 터미널로 인수</span>
			</h2>
			{cmux.length === 0 && <p className="muted">실행 중인 cmux Claude 세션이 없습니다.</p>}
			{Object.entries(cmuxByWs).map(([ws, list]) => (
				<div key={ws} className="ws-group">
					<h3 className="ws-head">
						📦 {ws} <span className="muted">· {list.length}</span>
					</h3>
					{list.map((s) => (
						<div key={s.sessionId} className="cmux-row">
							<span className="dot up" />
							<span className="cmux-title">{s.title}</span>
							<code className="cmux-cwd">{(s.cwd || '').split('/').slice(-1)[0]}</code>
							<code className="cmux-sid">{s.sessionId.slice(0, 8)}</code>
							<button
								className="btn-send cmux-adopt"
								onClick={() => adoptCmux(s)}
								title="claude --resume 으로 같은 세션을 MRM 터미널에서 연다"
							>
								▶ MRM 터미널로 열기
							</button>
						</div>
					))}
				</div>
			))}

			<div className="callout-box" style={{ marginTop: 18 }}>
				🛠️ <b>개발실</b> — <b>＋새 작업</b>: 티켓/브랜치 입력 → <code>git worktree add</code>로 격리 폴더 생성 →
				그 안에서 <code>claude</code> 실행 + 초기 지시 주입.
				<b> 개발 에이전트</b>는 영속 tmux라 MRM을 꺼도 살아있고, 타일을 <b>⛶ 포커스</b>하면 전체폭으로 직접
				타이핑할 수 있습니다.
				<b> cmux 세션</b>은 <code>claude --resume</code>으로 인수 — 최종적으로 cmux 없이 MRM만 쓰기 위한 전환.
			</div>

			{classModal &&
				createPortal(
					<div className="modal-backdrop" onClick={() => setClassModal(null)}>
						<div className="modal class-modal" onClick={(e) => e.stopPropagation()}>
							<div className="modal-head">
								<b>🧭 업무 성격 판정 — 코드 변경인가요?</b>
								<button className="modal-x" onClick={() => setClassModal(null)}>
									✕
								</button>
							</div>
							<div className="modal-body">
								<div className="cm-title">{classModal.title}</div>
								{(() => {
									const cur = classModal.taskClass ? CLASS_META[classModal.taskClass] : null
									return (
										<div className={`cm-verdict ${cur ? cur.cls : 'pending'}`}>
											{cur ? (
												<>
													<span className="cm-badge">
														{cur.icon} {cur.label}
													</span>
													<span className="cm-meta">
														{classModal.classManual
															? '· 마티 확정'
															: `· AI 판정${
																	classModal.classConfidence != null
																		? ` · 확신 ${Math.round(
																				classModal.classConfidence * 100
																		  )}%`
																		: ''
															  }`}
													</span>
												</>
											) : (
												<span className="cm-meta">
													아직 분류 중… AI가 코드/비개발을 판정하고 있어요 (상단 진행바)
												</span>
											)}
										</div>
									)
								})()}
								{classModal.classReason && <div className="cm-reason">💬 {classModal.classReason}</div>}
								{classModal.taskClass === 'ops' && classModal.classPlan && (
									<div className="cm-plan">📋 처리 제안: {classModal.classPlan}</div>
								)}
								{classModal.opsResult && (
									<div className="cm-reason">
										{classModal.opsResult.needsHuman ? '🙋 확인 필요' : '✅ 처리됨'} ·{' '}
										{classModal.opsResult.summary}
									</div>
								)}
								<p className="muted cm-help">
									확정하면 배지가 고정됩니다. <b>비개발</b>은 워크트리·PR(＋새 작업 / ▶진행) 경로에서
									빠지고, <b>▶ 지금 처리</b>로 워크트리 없이 노션 정리·문서·리서치를 에이전트가 바로
									수행합니다.
								</p>
								<div className="cm-actions">
									<button
										className={`cm-btn dev ${classModal.taskClass === 'dev' ? 'on' : ''}`}
										onClick={() => setClassOf(classModal.key, 'dev')}
									>
										🧑‍💻 개발로 확정
									</button>
									<button
										className={`cm-btn ops ${classModal.taskClass === 'ops' ? 'on' : ''}`}
										onClick={() => setClassOf(classModal.key, 'ops')}
									>
										📋 비개발로 확정
									</button>
								</div>
								<div className="cm-actions">
									<button
										className="cm-btn ops go"
										onClick={() => startOpsOf(classModal.key)}
										disabled={classModal.opsRunning}
									>
										{classModal.opsRunning
											? '⏳ 처리 중…'
											: classModal.opsResult
											? '🔄 다시 처리'
											: '▶ 지금 비개발 처리'}
									</button>
									<button
										className="cm-btn re"
										onClick={() => {
											reclassify(classModal.key)
											setClassModal(null)
										}}
										disabled={classBusy.has(classModal.key)}
									>
										🔄 AI 재판정
									</button>
								</div>
							</div>
						</div>
					</div>,
					document.body
				)}
		</>
	)
}
