export type StatusCode = 'working' | 'blocked' | 'idle'

export interface AgentStatus {
	code: StatusCode
	label: string
	dot: 'g' | 'y' | 'w'
}

export interface Agent {
	agent: string
	color: string
	tmuxSession?: string
	cmuxWorkspace?: string
	worktreePath?: string
	devUrl?: string | null
	ports?: Record<string, number>
	chain: string[]
	currentBacklog: string | null
	pr: number | null
	status: AgentStatus
	tmuxAlive: boolean
	lastOutput: string | null
	lastPrompt: string | null
	lastPromptAt: string | null
	leadNote: string | null
	devPortUp: boolean | null
}

export interface Backlog {
	id: string
	title: string
	branch?: string
	pr: number | null
	prUrl: string | null
	status: string
	notionUrl: string | null
	figmaNodes: string[]
}

export type Lane = 'plan' | 'progress' | 'review' | 'hold' | 'done'

export interface Analysis {
	range: { days: number; since: string | null; totalCommits: number }
	activeDays: number
	nightRatio: number
	byHour: number[]
	byWeekday: number[]
	byDay: { date: string; count: number }[]
	topAuthors: { name: string; count: number }[]
	domainChurn: { path: string; files: number; add: number; del: number }[]
	backlogLanes: Record<string, number>
	backlogTotal: number
	agentUtil: { agent: string; chainLen: number; status?: string; alive?: boolean }[]
	feature: string | null
	builtAt: string
	error?: string
}

export interface Model {
	feature: string | null
	epic: { id?: string; branch?: string; notionUrl?: string } | null
	phase: string | null
	lastUpdated: string | null
	counts: {
		agents: number
		working: number
		blocked: number
		idle: number
		backlogs: number
		byLane: Record<Lane, number>
		byStatus: Record<string, number>
	}
	agents: Agent[]
	backlogs: Record<Lane, Backlog[]>
	runtimeFreshness: { tmux: number; ports: number; prs: number }
	repo?: string
	statePath?: string
	stateMtime?: string | null
	builtAt?: string
	error?: string
}
