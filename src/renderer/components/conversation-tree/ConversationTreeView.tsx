/**
 * 对话树视图组件
 * 使用 ReactFlow 渲染节点式对话界面
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { Session } from 'src/shared/types'
import { sessionToConversationTree, debugPrintTree, type TreeNodeData } from '@/lib/conversation-tree-adapter'
import { applyTreeLayout } from '@/lib/tree-layout'
import { useViewModeStore } from '@/stores/viewModeStore'
import { nodeTypes } from './nodes'
import { edgeTypes } from './edges'
import { cn } from '@/lib/utils'

// ============ 类型定义 ============

export interface ConversationTreeViewProps {
  session: Session
  className?: string
}

// ============ 内部组件 ============

function ConversationTreeViewInner({ session, className }: ConversationTreeViewProps) {
  const { fitView } = useReactFlow()
  const setSelectedNodeId = useViewModeStore((s) => s.setSelectedNodeId)
  const selectedNodeId = useViewModeStore((s) => s.selectedNodeId)
  const prevSessionRef = useRef<string | null>(null)

  // 将 Session 转换为树结构并应用布局
  const tree = useMemo(() => {
    const rawTree = sessionToConversationTree(session)
    const layoutedTree = applyTreeLayout(rawTree)

    // 开发环境下打印调试信息
    if (process.env.NODE_ENV === 'development') {
      debugPrintTree(layoutedTree)
    }

    return layoutedTree
  }, [session])

  // ReactFlow 状态 - 使用泛型版本
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TreeNodeData>>(tree.nodes as Node<TreeNodeData>[])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(tree.edges)

  // 当树结构变化时更新节点和边
  useEffect(() => {
    setNodes(tree.nodes as Node<TreeNodeData>[])
    setEdges(tree.edges)

    // 如果是新会话，自动适配视图
    if (prevSessionRef.current !== session.id) {
      prevSessionRef.current = session.id
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 })
      }, 100)
    }
  }, [tree, session.id, setNodes, setEdges, fitView])

  // 节点点击处理
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
      console.log('Node clicked:', node.id)
    },
    [setSelectedNodeId]
  )

  // 节点右键菜单处理（预留）
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      console.log('Node context menu:', node.id)
      // TODO: 阶段三实现右键菜单
    },
    []
  )

  // 画布点击处理（取消选中）
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  // 小地图节点颜色
  const nodeColor = useCallback((node: Node) => {
    const data = node.data as TreeNodeData | undefined
    if (!data?.isActivePath) {
      return '#9ca3af' // gray-400
    }
    switch (data?.type) {
      case 'system':
        return '#6b7280' // gray-500
      case 'user':
        return '#3b82f6' // blue-500
      case 'assistant':
        return '#22c55e' // green-500
      default:
        return '#6b7280'
    }
  }, [])

  return (
    <div className={cn('w-full h-full', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes as any}
        edgeTypes={edgeTypes as any}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'default',
        }}
        proOptions={{ hideAttribution: true }}
      >
        {/* 控制面板 */}
        <Controls
          showZoom
          showFitView
          showInteractive={false}
          position="bottom-right"
        />

        {/* 小地图 */}
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeWidth={3}
          zoomable
          pannable
          position="bottom-left"
        />

        {/* 背景网格 */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#e5e7eb"
        />
      </ReactFlow>

      {/* 空状态提示 */}
      {tree.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400">
            <div className="text-lg mb-2">No messages yet</div>
            <div className="text-sm">Start a conversation to see the tree view</div>
          </div>
        </div>
      )}

      {/* 调试信息（开发环境） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs p-2 rounded">
          Nodes: {tree.nodes.length} | Edges: {tree.edges.length}
          {selectedNodeId && <div>Selected: {selectedNodeId.slice(0, 8)}...</div>}
        </div>
      )}
    </div>
  )
}

// ============ 导出组件 ============

/**
 * 对话树视图组件
 * 需要用 ReactFlowProvider 包裹以使用 hooks
 */
export function ConversationTreeView(props: ConversationTreeViewProps) {
  return (
    <ReactFlowProvider>
      <ConversationTreeViewInner {...props} />
    </ReactFlowProvider>
  )
}

export default ConversationTreeView
