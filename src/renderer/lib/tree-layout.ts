/**
 * 对话树布局算法
 * 使用 dagre 实现垂直方向的自动布局
 */

import dagre from 'dagre'
import type { ConversationNode, ConversationEdge, ConversationTree } from './conversation-tree-adapter'

// ============ 布局配置 ============

export interface TreeLayoutOptions {
  /** 节点宽度 */
  nodeWidth?: number
  /** 节点高度 */
  nodeHeight?: number
  /** 水平间距（同级节点之间） */
  horizontalSpacing?: number
  /** 垂直间距（父子节点之间） */
  verticalSpacing?: number
  /** 布局方向: TB (从上到下) | LR (从左到右) */
  direction?: 'TB' | 'LR'
  /** 已保存的节点位置（用于保留手动调整的位置） */
  savedPositions?: Record<string, { x: number; y: number }>
}

const DEFAULT_OPTIONS: Required<Omit<TreeLayoutOptions, 'savedPositions'>> = {
  nodeWidth: 280,
  nodeHeight: 120,
  horizontalSpacing: 80,   // 增加水平间距，避免分支节点过近
  verticalSpacing: 140,    // 增加垂直间距，解决连接线回流问题
  direction: 'TB',
}

// ============ 布局函数 ============

/**
 * 对对话树应用自动布局
 * 如果提供了 savedPositions，已保存位置的节点将保持不变，只对新节点应用自动布局
 * @param tree 对话树
 * @param options 布局选项
 * @returns 带有计算位置的新树结构
 */
export function applyTreeLayout(
  tree: ConversationTree,
  options: TreeLayoutOptions = {}
): ConversationTree {
  if (tree.nodes.length === 0) {
    return tree
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }
  const savedPositions = options.savedPositions || {}

  // 分离已有位置的节点和需要布局的新节点
  const nodesWithSavedPosition: ConversationNode[] = []
  const nodesNeedingLayout: ConversationNode[] = []

  for (const node of tree.nodes) {
    if (savedPositions[node.id]) {
      nodesWithSavedPosition.push({
        ...node,
        position: savedPositions[node.id],
      })
    } else {
      nodesNeedingLayout.push(node)
    }
  }

  // 如果所有节点都有保存的位置，直接返回
  if (nodesNeedingLayout.length === 0) {
    return {
      ...tree,
      nodes: nodesWithSavedPosition,
    }
  }

  // 如果没有任何保存的位置，使用完整的自动布局
  if (nodesWithSavedPosition.length === 0) {
    return applyFullAutoLayout(tree, opts)
  }

  // 混合模式：为新节点计算位置
  // 策略：找到新节点的父节点，基于父节点位置计算新节点位置
  const layoutedNodes = [...nodesWithSavedPosition]
  const nodePositionMap = new Map(nodesWithSavedPosition.map(n => [n.id, n.position]))
  
  // 构建边的映射：target -> source (子节点 -> 父节点)
  const parentMap = new Map<string, string>()
  // 构建边的映射：source -> targets (父节点 -> 子节点列表)
  const childrenMap = new Map<string, string[]>()
  
  for (const edge of tree.edges) {
    parentMap.set(edge.target, edge.source)
    const children = childrenMap.get(edge.source) || []
    children.push(edge.target)
    childrenMap.set(edge.source, children)
  }

  // 按深度排序新节点，确保父节点先处理
  const sortedNewNodes = [...nodesNeedingLayout].sort((a, b) => {
    return (a.data.depth || 0) - (b.data.depth || 0)
  })

  for (const node of sortedNewNodes) {
    const parentId = parentMap.get(node.id)
    let position = { x: 0, y: 0 }

    if (parentId && nodePositionMap.has(parentId)) {
      const parentPos = nodePositionMap.get(parentId)!
      const siblings = childrenMap.get(parentId) || []
      const siblingIndex = siblings.indexOf(node.id)
      const totalSiblings = siblings.length
      
      // 计算水平偏移：如果有多个兄弟节点，需要分散排列
      let xOffset = 0
      if (totalSiblings > 1) {
        // 计算已存在兄弟节点的位置，找到合适的空位
        const existingSiblingPositions = siblings
          .filter(id => id !== node.id && nodePositionMap.has(id))
          .map(id => nodePositionMap.get(id)!.x)
        
        if (existingSiblingPositions.length > 0) {
          // 在现有兄弟节点的右侧放置
          const maxX = Math.max(...existingSiblingPositions)
          xOffset = maxX - parentPos.x + opts.nodeWidth + opts.horizontalSpacing
        } else {
          // 第一个子节点，根据索引计算偏移
          const centerOffset = (totalSiblings - 1) / 2
          xOffset = (siblingIndex - centerOffset) * (opts.nodeWidth + opts.horizontalSpacing)
        }
      }
      
      position = {
        x: parentPos.x + xOffset,
        y: parentPos.y + opts.nodeHeight + opts.verticalSpacing,
      }
    } else {
      // 没有父节点或父节点位置未知，使用 dagre 计算
      const tempTree = { ...tree, nodes: [node], edges: [] }
      const layouted = applyFullAutoLayout(tempTree, opts)
      position = layouted.nodes[0]?.position || { x: 0, y: 0 }
    }

    nodePositionMap.set(node.id, position)
    layoutedNodes.push({
      ...node,
      position,
    })
  }

  return {
    ...tree,
    nodes: layoutedNodes,
  }
}

/**
 * 应用完整的自动布局（使用 dagre）
 * 针对分支情况进行优化，确保足够的垂直间距
 */
function applyFullAutoLayout(
  tree: ConversationTree,
  opts: Required<Omit<TreeLayoutOptions, 'savedPositions'>>
): ConversationTree {
  // 创建 dagre 图
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: opts.direction,
    nodesep: opts.horizontalSpacing,
    ranksep: opts.verticalSpacing,
    marginx: 40,
    marginy: 40,
    // 使用 network-simplex 算法，对树形结构效果更好
    ranker: 'network-simplex',
  })
  g.setDefaultEdgeLabel(() => ({}))

  // 添加节点
  for (const node of tree.nodes) {
    g.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight,
    })
  }

  // 添加边
  for (const edge of tree.edges) {
    g.setEdge(edge.source, edge.target)
  }

  // 执行布局计算
  dagre.layout(g)

  // 更新节点位置
  const layoutedNodes: ConversationNode[] = tree.nodes.map((node) => {
    const nodeWithPosition = g.node(node.id)
    if (!nodeWithPosition) {
      return node
    }

    return {
      ...node,
      position: {
        // dagre 返回的是节点中心点，需要转换为左上角
        x: nodeWithPosition.x - opts.nodeWidth / 2,
        y: nodeWithPosition.y - opts.nodeHeight / 2,
      },
    }
  })

  return {
    ...tree,
    nodes: layoutedNodes,
  }
}

/**
 * 计算树的边界框
 */
export function getTreeBounds(tree: ConversationTree): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
} {
  if (tree.nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const node of tree.nodes) {
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + DEFAULT_OPTIONS.nodeWidth)
    maxY = Math.max(maxY, node.position.y + DEFAULT_OPTIONS.nodeHeight)
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * 计算适合视口的缩放级别
 */
export function calculateFitViewZoom(
  tree: ConversationTree,
  viewportWidth: number,
  viewportHeight: number,
  padding = 50
): { zoom: number; x: number; y: number } {
  const bounds = getTreeBounds(tree)

  if (bounds.width === 0 || bounds.height === 0) {
    return { zoom: 1, x: 0, y: 0 }
  }

  const availableWidth = viewportWidth - padding * 2
  const availableHeight = viewportHeight - padding * 2

  const zoomX = availableWidth / bounds.width
  const zoomY = availableHeight / bounds.height
  const zoom = Math.min(zoomX, zoomY, 1.5) // 最大缩放 1.5x

  // 计算居中位置
  const centerX = bounds.minX + bounds.width / 2
  const centerY = bounds.minY + bounds.height / 2

  return {
    zoom: Math.max(0.1, zoom), // 最小缩放 0.1x
    x: viewportWidth / 2 - centerX * zoom,
    y: viewportHeight / 2 - centerY * zoom,
  }
}

/**
 * 获取节点在视口中的位置
 */
export function getNodeViewportPosition(
  node: ConversationNode,
  zoom: number,
  panX: number,
  panY: number
): { x: number; y: number } {
  return {
    x: node.position.x * zoom + panX,
    y: node.position.y * zoom + panY,
  }
}

/**
 * 计算滚动到指定节点的视口位置
 */
export function calculateScrollToNode(
  node: ConversationNode,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number
): { x: number; y: number } {
  const nodeCenterX = node.position.x + DEFAULT_OPTIONS.nodeWidth / 2
  const nodeCenterY = node.position.y + DEFAULT_OPTIONS.nodeHeight / 2

  return {
    x: viewportWidth / 2 - nodeCenterX * zoom,
    y: viewportHeight / 2 - nodeCenterY * zoom,
  }
}

/**
 * 强制重新计算所有节点的布局位置
 * 忽略已保存的位置，使用 dagre 重新排列
 */
export function forceRelayout(
  tree: ConversationTree,
  options: TreeLayoutOptions = {}
): ConversationTree {
  if (tree.nodes.length === 0) {
    return tree
  }
  const opts = { ...DEFAULT_OPTIONS, ...options }
  return applyFullAutoLayout(tree, opts)
}
