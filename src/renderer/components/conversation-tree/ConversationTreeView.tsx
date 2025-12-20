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
  useOnViewportChange,
  ReactFlowProvider,
  type Node,
  type Connection,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { Session, Message } from 'src/shared/types'
import { sessionToConversationTree, debugPrintTree, type TreeNodeData } from '@/lib/conversation-tree-adapter'
import { applyTreeLayout } from '@/lib/tree-layout'
import { useViewModeStore } from '@/stores/viewModeStore'
import { useUIStore } from '@/stores/uiStore'
import { useMantineColorScheme } from '@mantine/core'
import { nodeTypes } from './nodes'
import { edgeTypes } from './edges'
import { cn } from '@/lib/utils'
import MessageDetailDrawer from './MessageDetailDrawer'
import NodeCreatePopover from './NodeCreatePopover'
import { insertMessageAfter, generateMore, switchFork, createNewFork, regenerateInNewFork } from '@/stores/sessionActions'
import { createMessage } from 'src/shared/types'

// ============ 常量 ============

const EMPTY_POSITIONS: Record<string, { x: number; y: number }> = {}

/** 节点默认高度 */
const NODE_HEIGHT = 120
/** 节点间垂直间距 */
const VERTICAL_SPACING = 80

// ============ 类型定义 ============

export interface ConversationTreeViewProps {
  session: Session
  className?: string
  onCreateUserNode?: (content: string, targetMessageId: string) => void
  onCreateAssistantNode?: (targetMessageId: string) => void
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
  const { fitView, getViewport, setViewport } = useReactFlow()
  const { colorScheme } = useMantineColorScheme()
  const realTheme = useUIStore((state) => state.realTheme)
  const isDarkMode = colorScheme === 'dark' || realTheme === 'dark'
  
  // Store selectors
  const setSelectedNodeId = useViewModeStore((s) => s.setSelectedNodeId)
  const selectedNodeId = useViewModeStore((s) => s.selectedNodeId)
  const updateNodePosition = useViewModeStore((s) => s.updateNodePosition)
  const updateNodePositions = useViewModeStore((s) => s.updateNodePositions)
  const nodePositionsFromStore = useViewModeStore((s) => s.nodePositions[session.id]) ?? EMPTY_POSITIONS
  const saveSessionViewport = useViewModeStore((s) => s.saveSessionViewport)
  const sessionViewport = useViewModeStore((s) => s.sessionViewports[session.id])
  const setQuote = useUIStore((state) => state.setQuote)
  
  // Refs
  const prevSessionRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pendingPositionSaveRef = useRef<Record<string, { x: number; y: number }>>({})
  const isInitialMountRef = useRef<boolean>(true)
  
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
    // 传递保存的节点位置，让布局算法基于已有位置计算新节点位置
    const layoutedTree = applyTreeLayout(rawTree, { savedPositions: nodePositionsFromStore })
    if (process.env.NODE_ENV === 'development') {
      debugPrintTree(layoutedTree)
    }
    return layoutedTree
  }, [session, nodePositionsFromStore])

  // 初始化节点时优先使用保存的位置
  const initialNodes = useMemo(() => {
    return tree.nodes.map(node => {
      const savedPosition = nodePositionsFromStore[node.id]
      return savedPosition ? { ...node, position: savedPosition } : node
    })
  }, [tree.nodes, nodePositionsFromStore])

  // ReactFlow 状态
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes as any)
  const [edges, setEdges, onEdgesChange] = useEdgesState(tree.edges as any)

  // 根据节点 ID 获取消息
  const getMessageById = useCallback((nodeId: string): Message | null => {
    const mainMsg = session.messages.find(m => m.id === nodeId)
    if (mainMsg) return mainMsg
    
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
    return !(node.data as TreeNodeData).hasChildren
  }, [tree.nodes])

  // 查找消息的父消息 ID
  const findParentMessageId = useCallback((messageId: string): string | null => {
    const edge = tree.edges.find(e => e.target === messageId)
    return edge?.source || null
  }, [tree.edges])

  // 当树结构变化时更新节点和边（保留已有位置）
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setNodes((currentNodes) => {
        const currentPositionMap = new Map(currentNodes.map(n => [n.id, n.position]))
        const newPositionsToSave: Record<string, { x: number; y: number }> = {}
        
        const updatedNodes = tree.nodes.map(node => {
          const currentPosition = currentPositionMap.get(node.id)
          const savedPosition = nodePositionsFromStore[node.id]
          const finalPosition = currentPosition || savedPosition || node.position
          
          if (!savedPosition && !currentPosition) {
            newPositionsToSave[node.id] = node.position
          }
          
          return { ...node, position: finalPosition }
        })
        
        if (Object.keys(newPositionsToSave).length > 0) {
          pendingPositionSaveRef.current = { ...pendingPositionSaveRef.current, ...newPositionsToSave }
        }
        
        return updatedNodes as any
      })
      setEdges(tree.edges as any)
    }, 0)

    // 会话切换或组件首次挂载时处理视口
    const isSessionChange = prevSessionRef.current !== session.id
    const isFirstMount = isInitialMountRef.current
    
    if (isSessionChange || isFirstMount) {
      prevSessionRef.current = session.id
      
      // 延迟恢复或适配视口
      setTimeout(() => {
        if (sessionViewport) {
          // 恢复保存的视口状态
          setViewport(sessionViewport, { duration: 200 })
        } else if (!isFirstMount) {
          // 切换到新会话（无保存状态）时自动适配视图
          fitView({ padding: 0.2, duration: 300 })
        } else {
          // 首次挂载且无保存状态时自动适配视图
          fitView({ padding: 0.2, duration: 300 })
        }
        isInitialMountRef.current = false
      }, 100)
    }

    return () => clearTimeout(timeoutId)
  }, [tree, session.id, setNodes, setEdges, fitView, nodePositionsFromStore, sessionViewport, setViewport])

  // 延迟保存新节点位置（避免循环更新）
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      const pendingPositions = pendingPositionSaveRef.current
      if (Object.keys(pendingPositions).length > 0) {
        updateNodePositions(session.id, pendingPositions)
        pendingPositionSaveRef.current = {}
      }
    }, 100)
    return () => clearTimeout(saveTimer)
  }, [tree.nodes.length, session.id, updateNodePositions])

  // 监听 Handle 点击事件
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleNodeHandleClick = (e: Event) => {
      const { nodeId, element } = (e as CustomEvent<{ nodeId: string; element: HTMLElement }>).detail
      const message = getMessageById(nodeId)
      if (message) {
        setPopoverMessage(message)
        setPopoverTarget(element)
        setPopoverIsLeaf(isLeafNode(nodeId))
        setPopoverOpened(true)
      }
    }

    container.addEventListener('node-handle-click', handleNodeHandleClick)
    return () => container.removeEventListener('node-handle-click', handleNodeHandleClick)
  }, [getMessageById, isLeafNode])

  // 关闭 Popover
  const handleClosePopover = useCallback(() => {
    setPopoverOpened(false)
    setPopoverTarget(null)
    setPopoverMessage(null)
  }, [])

  // 画布视口变化时关闭 Popover 并保存视口状态
  useOnViewportChange({
    onChange: useCallback(() => {
      if (popoverOpened) handleClosePopover()
    }, [popoverOpened, handleClosePopover]),
    onEnd: useCallback(() => {
      // 视口变化结束时保存状态
      const viewport = getViewport()
      saveSessionViewport(session.id, viewport)
    }, [session.id, getViewport, saveSessionViewport]),
  })

  // 节点点击 - 打开详情抽屉
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
    const message = getMessageById(node.id)
    if (message) {
      setSelectedMessage(message)
      setDrawerOpened(true)
    }
  }, [setSelectedNodeId, getMessageById])

  // 节点双击 - 切换分支
  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const nodeData = node.data as TreeNodeData
    if (!nodeData.isActivePath && nodeData.branchCount > 1) {
      switchFork(session.id, node.id, 'next')
    }
  }, [session.id])

  // 节点拖拽结束 - 保存位置
  const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    updateNodePosition(session.id, node.id, node.position)
  }, [session.id, updateNodePosition])

  // 画布点击 - 取消选中
  const handlePaneClick = useCallback(() => setSelectedNodeId(null), [setSelectedNodeId])

  // 关闭抽屉
  const handleCloseDrawer = useCallback(() => {
    setDrawerOpened(false)
    setSelectedMessage(null)
  }, [])

  // 处理引用
  const handleQuote = useCallback((quotedText: string) => {
    const formattedQuote = quotedText.split('\n').map(line => `> ${line}`).join('\n')
    setQuote(formattedQuote + '\n\n')
  }, [setQuote])

  // 获取节点当前位置（优先从 ReactFlow 状态获取，其次从 store 获取）
  const getNodePosition = useCallback((nodeId: string): { x: number; y: number } | null => {
    // 先从当前 ReactFlow 节点状态获取
    const currentNode = nodes.find(n => n.id === nodeId)
    if (currentNode) {
      return currentNode.position
    }
    // 再从 store 获取
    const savedPosition = nodePositionsFromStore[nodeId]
    if (savedPosition) {
      return savedPosition
    }
    // 最后从 tree 获取
    const treeNode = tree.nodes.find(n => n.id === nodeId)
    return treeNode?.position || null
  }, [nodes, nodePositionsFromStore, tree.nodes])

  // 计算新节点位置（基于触发节点位置）
  const calculateNewNodePosition = useCallback((triggerNodeId: string): { x: number; y: number } => {
    const triggerPosition = getNodePosition(triggerNodeId)
    if (!triggerPosition) {
      return { x: 0, y: 0 }
    }
    // 新节点位于触发节点正下方
    return {
      x: triggerPosition.x,
      y: triggerPosition.y + NODE_HEIGHT + VERTICAL_SPACING,
    }
  }, [getNodePosition])

  // 预保存新节点位置（在创建消息之前调用）
  const presaveNewNodePosition = useCallback((newNodeId: string, triggerNodeId: string) => {
    const newPosition = calculateNewNodePosition(triggerNodeId)
    updateNodePosition(session.id, newNodeId, newPosition)
  }, [session.id, calculateNewNodePosition, updateNodePosition])

  // 创建 User 节点
  const handleCreateUserNode = useCallback(async (content: string, targetMessageId: string) => {
    if (onCreateUserNode) {
      onCreateUserNode(content, targetMessageId)
      return
    }
    
    const targetMessage = getMessageById(targetMessageId)
    if (!targetMessage) return
    
    const newMsg = createMessage('user', content)
    const isLeaf = isLeafNode(targetMessageId)
    
    // 预先保存新节点位置（基于触发节点位置）
    presaveNewNodePosition(newMsg.id, targetMessageId)
    
    if (!isLeaf) {
      await createNewFork(session.id, targetMessageId)
      await insertMessageAfter(session.id, newMsg, targetMessageId)
    } else if (targetMessage.role === 'user') {
      const parentId = findParentMessageId(targetMessageId)
      if (parentId) {
        await createNewFork(session.id, parentId)
        await insertMessageAfter(session.id, newMsg, parentId)
        // 如果是在父节点下创建，更新位置为父节点下方
        presaveNewNodePosition(newMsg.id, parentId)
      } else {
        await insertMessageAfter(session.id, newMsg, targetMessageId)
      }
    } else {
      await insertMessageAfter(session.id, newMsg, targetMessageId)
    }
    
    generateMore(session.id, newMsg.id)
  }, [session.id, onCreateUserNode, getMessageById, findParentMessageId, isLeafNode, presaveNewNodePosition])

  // 创建 Assistant 节点
  const handleCreateAssistantNode = useCallback(async (targetMessageId: string) => {
    if (onCreateAssistantNode) {
      onCreateAssistantNode(targetMessageId)
      return
    }
    
    const targetMessage = getMessageById(targetMessageId)
    if (!targetMessage) return
    
    if (targetMessage.role === 'assistant') {
      await regenerateInNewFork(session.id, targetMessage)
    } else {
      generateMore(session.id, targetMessageId)
    }
  }, [session.id, onCreateAssistantNode, getMessageById])

  // 使用底部输入框
  const handleUseBottomInput = useCallback((targetMessageId: string) => {
    onUseBottomInput?.(targetMessageId)
  }, [onUseBottomInput])

  // 小地图节点颜色
  const nodeColor = useCallback((node: Node) => {
    const data = node.data as TreeNodeData | undefined
    if (!data?.isActivePath) return isDarkMode ? '#6b7280' : '#9ca3af'
    switch (data?.type) {
      case 'system': return isDarkMode ? '#9ca3af' : '#6b7280'
      case 'user': return '#3b82f6'
      case 'assistant': return '#22c55e'
      default: return isDarkMode ? '#9ca3af' : '#6b7280'
    }
  }, [isDarkMode])

  return (
    <div ref={containerRef} className={cn('w-full h-full', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes as any}
        edgeTypes={edgeTypes as any}
        defaultViewport={sessionViewport || { x: 0, y: 0, zoom: 1 }}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Controls 
          showZoom 
          showFitView 
          showInteractive={false} 
          position="bottom-right"
          className={cn(
            '[&>button]:!bg-white [&>button]:!border-gray-200 [&>button]:!text-gray-600',
            'dark:[&>button]:!bg-gray-800 dark:[&>button]:!border-gray-600 dark:[&>button]:!text-gray-300',
            '[&>button:hover]:!bg-gray-100 dark:[&>button:hover]:!bg-gray-700'
          )}
        />
        <MiniMap 
          nodeColor={nodeColor} 
          nodeStrokeWidth={3} 
          zoomable 
          pannable 
          position="bottom-left"
          className={cn(
            '!bg-gray-100 !border-gray-200',
            'dark:!bg-gray-800 dark:!border-gray-600'
          )}
          maskColor={isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(240, 240, 240, 0.6)'}
        />
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1} 
          color={isDarkMode ? '#4b5563' : '#e5e7eb'} 
        />
      </ReactFlow>

      <MessageDetailDrawer
        opened={drawerOpened}
        onClose={handleCloseDrawer}
        message={selectedMessage}
        session={session}
        onQuote={handleQuote}
      />

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

      {tree.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400">
            <div className="text-lg mb-2">No messages yet</div>
            <div className="text-sm">Start a conversation to see the tree view</div>
          </div>
        </div>
      )}

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

export function ConversationTreeView(props: ConversationTreeViewProps) {
  return (
    <ReactFlowProvider>
      <ConversationTreeViewInner {...props} />
    </ReactFlowProvider>
  )
}

export default ConversationTreeView
