/**
 * 对话树适配器
 * 将 Session 数据结构转换为 ReactFlow 可用的节点和边结构
 */

import type { Node, Edge } from '@xyflow/react'
import type { Session, Message } from 'src/shared/types'

// ============ 类型定义 ============

/** 树节点类型 */
export type TreeNodeType = 'system' | 'user' | 'assistant'

/** 树节点数据 */
export interface TreeNodeData extends Record<string, unknown> {
  message: Message
  type: TreeNodeType
  /** 是否在当前活跃路径上 */
  isActivePath: boolean
  /** 在同级分支中的索引 */
  branchIndex: number
  /** 同级分支总数 */
  branchCount: number
  /** 是否有子分支 */
  hasChildren: boolean
  /** 子节点数量 */
  childrenCount: number
  /** 深度层级 */
  depth: number
}

/** ReactFlow 节点类型 */
export type ConversationNode = Node<TreeNodeData, TreeNodeType>

/** 边数据类型 */
export interface ConversationEdgeData {
  isActivePath: boolean
  branchIndex: number
}

/** ReactFlow 边类型 */
export type ConversationEdge = Edge<ConversationEdgeData>

/** 对话树结构 */
export interface ConversationTree {
  nodes: ConversationNode[]
  edges: ConversationEdge[]
  /** 根节点ID */
  rootId: string | null
  /** 当前活跃路径的叶子节点ID */
  activeLeafId: string | null
  /** 所有活跃路径上的节点ID集合 */
  activePathIds: Set<string>
}

// ============ 内部辅助类型 ============

interface TreeBuildContext {
  nodes: ConversationNode[]
  edges: ConversationEdge[]
  activePathIds: Set<string>
  depth: number
}

// ============ 核心转换函数 ============

/**
 * 将 Session 转换为对话树结构
 */
export function sessionToConversationTree(session: Session): ConversationTree {
  const context: TreeBuildContext = {
    nodes: [],
    edges: [],
    activePathIds: new Set(),
    depth: 0,
  }

  if (!session.messages || session.messages.length === 0) {
    return {
      nodes: [],
      edges: [],
      rootId: null,
      activeLeafId: null,
      activePathIds: new Set(),
    }
  }

  // 1. 首先构建活跃路径的节点ID集合
  const activePathIds = buildActivePathIds(session)
  context.activePathIds = activePathIds

  // 2. 构建主消息链的节点
  let prevNodeId: string | null = null
  let activeLeafId: string | null = null

  for (let i = 0; i < session.messages.length; i++) {
    const message = session.messages[i]
    const isActivePath = activePathIds.has(message.id)
    
    // 检查此消息是否有分支
    const forkData = session.messageForksHash?.[message.id]
    const hasFork = forkData && forkData.lists.length > 1
    
    // 创建节点
    const node = createNode(message, {
      isActivePath,
      branchIndex: 0,
      branchCount: hasFork ? forkData.lists.length : 1,
      hasChildren: i < session.messages.length - 1 || !!hasFork,
      childrenCount: hasFork ? forkData.lists.length : (i < session.messages.length - 1 ? 1 : 0),
      depth: context.depth + i,
    })
    
    context.nodes.push(node)

    // 创建边
    if (prevNodeId) {
      context.edges.push(createEdge(prevNodeId, message.id, isActivePath, 0))
    }

    // 如果有分支，递归处理分支
    if (hasFork) {
      processForks(session, message.id, forkData, context, i)
    }

    prevNodeId = message.id
    if (isActivePath) {
      activeLeafId = message.id
    }
  }

  // 3. 找到最终的活跃叶子节点
  if (session.messages.length > 0) {
    const lastMessage = session.messages[session.messages.length - 1]
    const lastFork = session.messageForksHash?.[lastMessage.id]
    
    if (lastFork && lastFork.lists.length > 0) {
      // 当前活跃分支的消息
      const activeBranchMessages = lastFork.lists[lastFork.position]?.messages || []
      if (activeBranchMessages.length > 0) {
        activeLeafId = activeBranchMessages[activeBranchMessages.length - 1].id
      }
    } else {
      activeLeafId = lastMessage.id
    }
  }

  return {
    nodes: context.nodes,
    edges: context.edges,
    rootId: session.messages[0]?.id || null,
    activeLeafId,
    activePathIds,
  }
}

/**
 * 处理分支数据
 */
function processForks(
  session: Session,
  parentMessageId: string,
  forkData: NonNullable<Session['messageForksHash']>[string],
  context: TreeBuildContext,
  parentDepth: number
): void {
  const { lists, position } = forkData

  for (let branchIndex = 0; branchIndex < lists.length; branchIndex++) {
    const branch = lists[branchIndex]
    const isActiveBranch = branchIndex === position
    
    let prevNodeId = parentMessageId

    for (let i = 0; i < branch.messages.length; i++) {
      const message = branch.messages[i]
      const isActivePath = isActiveBranch && context.activePathIds.has(message.id)

      // 检查此消息是否也有分支
      const nestedFork = session.messageForksHash?.[message.id]
      const hasNestedFork = nestedFork && nestedFork.lists.length > 1

      const node = createNode(message, {
        isActivePath,
        branchIndex,
        branchCount: lists.length,
        hasChildren: i < branch.messages.length - 1 || !!hasNestedFork,
        childrenCount: hasNestedFork ? nestedFork.lists.length : (i < branch.messages.length - 1 ? 1 : 0),
        depth: parentDepth + 1 + i,
      })

      context.nodes.push(node)
      context.edges.push(createEdge(prevNodeId, message.id, isActivePath, branchIndex))

      // 递归处理嵌套分支
      if (hasNestedFork) {
        processForks(session, message.id, nestedFork, context, parentDepth + 1 + i)
      }

      prevNodeId = message.id
    }
  }
}

/**
 * 构建活跃路径的节点ID集合
 */
function buildActivePathIds(session: Session): Set<string> {
  const activeIds = new Set<string>()

  // 主消息链都是活跃的
  for (const message of session.messages) {
    activeIds.add(message.id)

    // 如果有分支，只有当前位置的分支是活跃的
    const forkData = session.messageForksHash?.[message.id]
    if (forkData) {
      const activeBranch = forkData.lists[forkData.position]
      if (activeBranch) {
        for (const branchMessage of activeBranch.messages) {
          activeIds.add(branchMessage.id)
        }
      }
    }
  }

  return activeIds
}

/**
 * 创建 ReactFlow 节点
 */
function createNode(
  message: Message,
  options: {
    isActivePath: boolean
    branchIndex: number
    branchCount: number
    hasChildren: boolean
    childrenCount: number
    depth: number
  }
): ConversationNode {
  const type = getNodeType(message.role)

  return {
    id: message.id,
    type,
    position: { x: 0, y: 0 }, // 位置由布局算法计算
    data: {
      message,
      type,
      isActivePath: options.isActivePath,
      branchIndex: options.branchIndex,
      branchCount: options.branchCount,
      hasChildren: options.hasChildren,
      childrenCount: options.childrenCount,
      depth: options.depth,
    },
  }
}

/**
 * 创建 ReactFlow 边
 */
function createEdge(
  sourceId: string,
  targetId: string,
  isActivePath: boolean,
  branchIndex = 0
): ConversationEdge {
  // 根据状态选择边类型
  let edgeType: string
  if (isActivePath) {
    edgeType = 'activePath'
  } else if (branchIndex > 0) {
    edgeType = 'branch'
  } else {
    edgeType = 'default'
  }

  return {
    id: `${sourceId}->${targetId}`,
    source: sourceId,
    target: targetId,
    type: edgeType,
    data: { isActivePath, branchIndex },
    animated: false, // 动画由自定义边组件控制
  }
}

/**
 * 根据消息角色获取节点类型
 */
function getNodeType(role: Message['role']): TreeNodeType {
  switch (role) {
    case 'system':
      return 'system'
    case 'user':
      return 'user'
    case 'assistant':
    case 'tool':
      return 'assistant'
    default:
      return 'user'
  }
}

// ============ 辅助函数 ============

/**
 * 获取消息的文本内容（用于节点预览）
 */
export function getMessagePreviewText(message: Message, maxLength = 100): string {
  const textParts = message.contentParts?.filter((part) => part.type === 'text') || []
  const text = textParts.map((part) => part.text).join(' ')
  
  if (text.length <= maxLength) {
    return text
  }
  
  return `${text.slice(0, maxLength)}...`
}

/**
 * 根据节点ID查找节点在树中的路径
 */
export function findNodePath(tree: ConversationTree, nodeId: string): string[] {
  const path: string[] = []
  const nodeMap = new Map(tree.nodes.map((n) => [n.id, n]))
  const edgeMap = new Map<string, string>() // target -> source

  for (const edge of tree.edges) {
    edgeMap.set(edge.target, edge.source)
  }

  let currentId: string | undefined = nodeId
  while (currentId) {
    path.unshift(currentId)
    currentId = edgeMap.get(currentId)
  }

  return path
}

/**
 * 检查节点是否是分支点（有多个子节点）
 */
export function isBranchPoint(tree: ConversationTree, nodeId: string): boolean {
  const childEdges = tree.edges.filter((e) => e.source === nodeId)
  return childEdges.length > 1
}

/**
 * 获取节点的所有子节点ID
 */
export function getChildNodeIds(tree: ConversationTree, nodeId: string): string[] {
  return tree.edges.filter((e) => e.source === nodeId).map((e) => e.target)
}

/**
 * 调试用：打印树结构
 */
export function debugPrintTree(tree: ConversationTree): void {
  console.group('🌳 Conversation Tree')
  console.log('Root ID:', tree.rootId)
  console.log('Active Leaf ID:', tree.activeLeafId)
  console.log('Active Path IDs:', Array.from(tree.activePathIds))
  console.log('Nodes:', tree.nodes.length)
  console.log('Edges:', tree.edges.length)

  console.group('Nodes Detail')
  for (const node of tree.nodes) {
    const prefix = tree.activePathIds.has(node.id) ? '✅' : '  '
    console.log(
      `${prefix} [${node.data.type}] ${node.id.slice(0, 8)}... - depth:${node.data.depth} branch:${node.data.branchIndex}/${node.data.branchCount}`
    )
  }
  console.groupEnd()

  console.groupEnd()
}
