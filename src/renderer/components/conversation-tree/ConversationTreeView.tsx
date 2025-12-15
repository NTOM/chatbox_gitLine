/**
 * 对话树视图组件
 * 使用 ReactFlow 渲染节点式对话界面
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { Session, Message } from 'src/shared/types'
import { sessionToConversationTree, debugPrintTree, type TreeNodeData } from '@/lib/conversation-tree-adapter'
import { applyTreeLayout } from '@/lib/tree-layout'
import { useViewModeStore } from '@/stores/viewModeStore'
import { useUIStore } from '@/stores/uiStore'
import { nodeTypes } from './nodes'
import { edgeTypes } from './edges'
import { cn } from '@/lib/utils'
import MessageDetailDrawer from './MessageDetailDrawer'
import NodeCreatePopover from './NodeCreatePopover'
import { insertMessageAfter, generateMore, switchFork, createNewFork, regenerateInNewFork } from '@/stores/sessionActions'
import { createMessage } from 'src/shared/types'

// ============ 类型定义 ============

export interface ConversationTreeViewProps {
  session: Session
  className?: string
  /** 创建 User 节点回调 */
  onCreateUserNode?: (content: string, targetMessageId: string) => void
  /** 创建 Assistant 节点回调 */
  onCreateAssistantNode?: (targetMessageId: string) => void
  /** 使用底部输入框回调 */
  onUseBottomInput?: (targetMessageId: string) => void
}

// ============ 内部组件 ============

function ConversationTreeViewInner({ 
  session, 
  className,
  onCreateUserNode,
  onCreateAssistantNode,
  onUseBottomInput,
}: ConversationTreeViewProps) {
  const { fitView } = useReactFlow()
  const setSelectedNodeId = useViewModeStore((s) => s.setSelectedNodeId)
  const selectedNodeId = useViewModeStore((s) => s.selectedNodeId)
  const setQuote = useUIStore((state) => state.setQuote)
  const prevSessionRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 消息详情抽屉状态
  const [drawerOpened, setDrawerOpened] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  
  // 创建节点 Popover 状态
  const [popoverOpened, setPopoverOpened] = useState(false)
  const [popoverTarget, setPopoverTarget] = useState<HTMLElement | null>(null)
  const [popoverMessage, setPopoverMessage] = useState<Message | null>(null)
  const [popoverIsLeaf, setPopoverIsLeaf] = useState(true)

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

  // ReactFlow 状态 - 使用 any 类型避免复杂的泛型问题
  const [nodes, setNodes, onNodesChange] = useNodesState(tree.nodes as any)
  const [edges, setEdges, onEdgesChange] = useEdgesState(tree.edges as any)

  // 当树结构变化时更新节点和边
  useEffect(() => {
    // 批量更新节点和边，避免多次渲染
    const timeoutId = setTimeout(() => {
      setNodes(tree.nodes as any)
      setEdges(tree.edges as any)
    }, 0)

    // 如果是新会话，自动适配视图
    if (prevSessionRef.current !== session.id) {
      prevSessionRef.current = session.id
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 })
      }, 100)
    }

    return () => clearTimeout(timeoutId)
  }, [tree, session.id, setNodes, setEdges, fitView])

  // 监听 Handle 点击事件
  useEffect(() => {
    const handleNodeHandleClick = (e: Event) => {
      const customEvent = e as CustomEvent<{ nodeId: string; nodeType: string; element: HTMLElement }>
      const { nodeId, element } = customEvent.detail
      
      const message = getMessageById(nodeId)
      if (message) {
        const isLeaf = isLeafNode(nodeId)
        setPopoverMessage(message)
        setPopoverTarget(element)
        setPopoverIsLeaf(isLeaf)
        setPopoverOpened(true)
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('node-handle-click', handleNodeHandleClick)
      return () => {
        container.removeEventListener('node-handle-click', handleNodeHandleClick)
      }
    }
  }, [session.messages, tree.nodes])

  // 根据节点 ID 获取消息
  const getMessageById = useCallback((nodeId: string): Message | null => {
    // 先从主消息列表查找
    const mainMsg = session.messages.find(m => m.id === nodeId)
    if (mainMsg) return mainMsg
    
    // 再从分支中查找
    if (session.messageForksHash) {
      for (const forkData of Object.values(session.messageForksHash)) {
        for (const branch of forkData.lists) {
          const branchMsg = branch.messages.find(m => m.id === nodeId)
          if (branchMsg) return branchMsg
        }
      }
    }
    return null
  }, [session.messages, session.messageForksHash])

  // 检查节点是否为叶子节点
  const isLeafNode = useCallback((nodeId: string): boolean => {
    const node = tree.nodes.find(n => n.id === nodeId)
    if (!node) return true
    const nodeData = node.data as TreeNodeData
    return !nodeData.hasChildren
  }, [tree.nodes])

  // 节点点击处理 - 打开消息详情抽屉
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
      const message = getMessageById(node.id)
      if (message) {
        setSelectedMessage(message)
        setDrawerOpened(true)
      }
    },
    [setSelectedNodeId, getMessageById]
  )

  // 节点双击处理 - 切换到该分支（通过循环切换）
  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const nodeData = node.data as TreeNodeData
      if (!nodeData.isActivePath && nodeData.branchCount > 1) {
        // 通过循环切换直到到达目标分支
        // 这里简化处理，直接切换到下一个分支
        switchFork(session.id, node.id, 'next')
      }
    },
    [session.id]
  )

  // 节点右键菜单处理
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      console.log('Node context menu:', node.id)
      // TODO: 实现右键菜单
    },
    []
  )

  // 连接点点击处理 - 创建新节点
  const handleConnect = useCallback(
    (connection: Connection) => {
      console.log('Connection attempt:', connection)
      // 暂不支持手动连接
    },
    []
  )

  // 画布点击处理（取消选中）
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  // 关闭抽屉
  const handleCloseDrawer = useCallback(() => {
    setDrawerOpened(false)
    setSelectedMessage(null)
  }, [])

  // 处理引用
  const handleQuote = useCallback((quotedText: string) => {
    const formattedQuote = quotedText
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
    setQuote(formattedQuote + '\n\n')
  }, [setQuote])

  // 关闭创建 Popover
  const handleClosePopover = useCallback(() => {
    setPopoverOpened(false)
    setPopoverTarget(null)
    setPopoverMessage(null)
  }, [])

  // 查找消息的父消息 ID
  const findParentMessageId = useCallback((messageId: string): string | null => {
    // 在树节点中查找父节点
    const edge = tree.edges.find(e => e.target === messageId)
    return edge?.source || null
  }, [tree.edges])

  // 创建 User 节点（并自动触发 AI 回复）
  // 如果当前节点是 User，则在父节点（Assistant）下创建分支
  // 如果当前节点是 Assistant，则在当前节点下创建子节点
  const handleCreateUserNode = useCallback(async (content: string, targetMessageId: string) => {
    if (onCreateUserNode) {
      onCreateUserNode(content, targetMessageId)
      return
    }
    
    const targetMessage = getMessageById(targetMessageId)
    if (!targetMessage) return
    
    const newMsg = createMessage('user', content)
    
    if (targetMessage.role === 'user') {
      // 当前是 User 节点，需要在父节点（Assistant）下创建新分支
      const parentId = findParentMessageId(targetMessageId)
      if (parentId) {
        // 先创建分支，然后插入消息
        await createNewFork(session.id, parentId)
        await insertMessageAfter(session.id, newMsg, parentId)
      } else {
        // 没有父节点，直接插入
        await insertMessageAfter(session.id, newMsg, targetMessageId)
      }
    } else {
      // 当前是 Assistant 节点，正常在其后插入
      await insertMessageAfter(session.id, newMsg, targetMessageId)
    }
    
    // 自动触发 AI 生成回复
    generateMore(session.id, newMsg.id)
  }, [session.id, onCreateUserNode, getMessageById, findParentMessageId])

  // 创建 Assistant 节点
  // 如果当前节点是 Assistant，则在父节点（User）下创建分支（重新生成）
  // 如果当前节点是 User，则在当前节点下生成回复
  const handleCreateAssistantNode = useCallback(async (targetMessageId: string) => {
    if (onCreateAssistantNode) {
      onCreateAssistantNode(targetMessageId)
      return
    }
    
    const targetMessage = getMessageById(targetMessageId)
    if (!targetMessage) return
    
    if (targetMessage.role === 'assistant') {
      // 当前是 Assistant 节点，使用 regenerateInNewFork 在父节点下创建新分支
      await regenerateInNewFork(session.id, targetMessage)
    } else {
      // 当前是 User 节点，正常生成回复
      generateMore(session.id, targetMessageId)
    }
  }, [session.id, onCreateAssistantNode, getMessageById])

  // 使用底部输入框
  const handleUseBottomInput = useCallback((targetMessageId: string) => {
    if (onUseBottomInput) {
      onUseBottomInput(targetMessageId)
    }
    // TODO: 设置底部输入框的目标节点
  }, [onUseBottomInput])

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
    <div ref={containerRef} className={cn('w-full h-full', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onConnect={handleConnect}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes as any}
        edgeTypes={edgeTypes as any}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
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

      {/* 消息详情抽屉 */}
      <MessageDetailDrawer
        opened={drawerOpened}
        onClose={handleCloseDrawer}
        message={selectedMessage}
        session={session}
        onQuote={handleQuote}
      />

      {/* 创建节点 Popover */}
      {popoverMessage && (
        <NodeCreatePopover
          opened={popoverOpened}
          onClose={handleClosePopover}
          target={popoverTarget}
          message={popoverMessage}
          session={session}
          isLeafNode={popoverIsLeaf}
          onCreateUserNode={handleCreateUserNode}
          onCreateAssistantNode={handleCreateAssistantNode}
          onUseBottomInput={handleUseBottomInput}
        />
      )}

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
