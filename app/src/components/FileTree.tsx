import { useState } from 'react'

export interface TreeNode {
	name: string
	path: string
	type: 'dir'
	files: number
	tests: number
	stories: number
	children: TreeNode[]
}

function Row({
	node,
	depth,
	selected,
	onSelect,
}: {
	node: TreeNode
	depth: number
	selected: string
	onSelect: (p: string) => void
}) {
	const [open, setOpen] = useState(depth < 1)
	const hasChildren = node.children.length > 0
	const isSel = selected === node.path

	return (
		<>
			<div
				className={`tree-row ${isSel ? 'sel' : ''}`}
				style={{ paddingLeft: 8 + depth * 14 }}
				onClick={() => {
					onSelect(node.path)
					if (hasChildren) setOpen((o) => (isSel ? !o : true))
				}}
			>
				<span className="caret">{hasChildren ? (open ? '▾' : '▸') : ''}</span>
				<span className="ico">📁</span>
				<span className="nm">{node.name}</span>
				<span className="cc">
					{node.files > 0 && <span title="코드 파일">{node.files}</span>}
					{node.tests > 0 && (
						<span className="t" title="테스트">
							✓{node.tests}
						</span>
					)}
					{node.stories > 0 && (
						<span className="s" title="스토리">
							◧{node.stories}
						</span>
					)}
				</span>
			</div>
			{open &&
				node.children.map((c) => (
					<Row key={c.path} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />
				))}
		</>
	)
}

export default function FileTree({
	tree,
	selected,
	onSelect,
}: {
	tree: TreeNode | null
	selected: string
	onSelect: (p: string) => void
}) {
	if (!tree)
		return (
			<div className="muted" style={{ padding: 12 }}>
				트리 로딩…
			</div>
		)
	return (
		<div className="tree">
			{tree.children.map((c) => (
				<Row key={c.path} node={c} depth={0} selected={selected} onSelect={onSelect} />
			))}
		</div>
	)
}
