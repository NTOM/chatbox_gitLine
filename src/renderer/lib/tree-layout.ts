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
}

const DEFAULT_OPTIONS: Required<TreeLayoutOptions> = {
  nodeWidth: 280,
  nodeHeight: 120,
  horizontalSpacing: 50,
  verticalSpacing: 80,
  direction: 'TB',
}

// ============ 布局函数 ============

/**
 * 对对话树应用自动布局
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

  // 创建 dagre 图
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: opts.direction,
    nodesep: opts.horizontalSpacing,
    ranksep: opts.verticalSpacing,
    marginx: 20,
    marginy: 20,
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
