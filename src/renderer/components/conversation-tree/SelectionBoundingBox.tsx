/**
 * 选中节点边界框组件
 * 在框选模式下显示选中节点的虚线边界框，支持拖拽移动整组节点
 */

import { memo, useCallback, useState, useRef, useEffect, useMemo } from 'react'
import { useReactFlow, useViewport } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { cn } from '@/lib/utils'

// ============ 类型定义 ============

export interface SelectionBoundingBoxProps {
  /** 选中的节点列表 */
  selectedNodes: Node[]
  /** 节点宽度 */
  nodeWidth?: number
  /** 节点高度 */
  nodeHeight?: number
  /** 边界框内边距 */
  padding?: number
  /** 节点位置更新回调 */
  onNodesMove?: (nodeIds: string[], deltaX: number, deltaY: number) => void
}

// ============ 常量 ============

const DEFAULT_NODE_WIDTH = 260
const DEFAULT_NODE_HEIGHT = 120
const DEFAULT_PADDING = 16

// ============ 组件 ============

function SelectionBoundingBoxComponent({
  selectedNodes,
  nodeWidth = DEFAULT_NODE_WIDTH,
  nodeHeight = DEFAULT_NODE_HEIGHT,
  padding = DEFAULT_PADDING,
  onNodesMove,
}: SelectionBoundingBoxProps) {
  const { setNodes } = useReactFlow()
  const viewport = useViewport()
  
  const [isDragging, setIsDragging] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const initialPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  // 是否应该显示边界框
  const shouldShow = selectedNodes.length >= 2

  // 计算边界框
  const bounds = useMemo(() => {
    if (!shouldShow) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }
    return calculateBounds(selectedNodes, nodeWidth, nodeHeight, padding)
  }, [shouldShow, selectedNodes, nodeWidth, nodeHeight, padding])

  // 转换为屏幕坐标
  const screenBounds = useMemo(() => ({
    x: bounds.x * viewport.zoom + viewport.x,
    y: bounds.y * viewport.zoom + viewport.y,
    width: bounds.width * viewport.zoom,
    height: bounds.height * viewport.zoom,
  }), [bounds, viewport])

  // 开始拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    
    // 保存所有选中节点的初始位置
    const positions = new Map<string, { x: number; y: number }>()
    selectedNodes.forEach(node => {
      positions.set(node.id, { ...node.position })
    })
    initialPositionsRef.current = positions
  }, [selectedNodes])

  // 拖拽中
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return

      const deltaX = (e.clientX - dragStartRef.current.x) / viewport.zoom
      const deltaY = (e.clientY - dragStartRef.current.y) / viewport.zoom

      // 更新所有选中节点的位置
      setNodes(nodes => 
        nodes.map(node => {
          const initialPos = initialPositionsRef.current.get(node.id)
          if (initialPos) {
            return {
              ...node,
              position: {
                x: initialPos.x + deltaX,
                y: initialPos.y + deltaY,
              },
            }
          }
          return node
        })
      )
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (dragStartRef.current && onNodesMove) {
        const deltaX = (e.clientX - dragStartRef.current.x) / viewport.zoom
        const deltaY = (e.clientY - dragStartRef.current.y) / viewport.zoom
        
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          const nodeIds = selectedNodes.map(n => n.id)
          onNodesMove(nodeIds, deltaX, deltaY)
        }
      }
      
      setIsDragging(false)
      dragStartRef.current = null
      initialPositionsRef.current.clear()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, viewport.zoom, setNodes, selectedNodes, onNodesMove])

  // 条件渲染放在所有 hooks 之后
  if (!shouldShow) {
    return null
  }

  return (
    <div
      className={cn(
        'absolute pointer-events-none z-10',
        'border-2 border-dashed rounded-lg',
        'transition-colors duration-150',
        isHovering || isDragging
          ? 'border-blue-500 bg-blue-500/5'
          : 'border-blue-400/60 bg-transparent'
      )}
      style={{
        left: screenBounds.x,
        top: screenBounds.y,
        width: screenBounds.width,
        height: screenBounds.height,
      }}
    >
      {/* 可拖拽的边框区域 */}
      {/* 上边框 */}
      <div
        className="absolute -top-2 left-0 right-0 h-4 cursor-move pointer-events-auto"
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => !isDragging && setIsHovering(false)}
      />
      {/* 下边框 */}
      <div
        className="absolute -bottom-2 left-0 right-0 h-4 cursor-move pointer-events-auto"
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => !isDragging && setIsHovering(false)}
      />
      {/* 左边框 */}
      <div
        className="absolute top-0 -left-2 bottom-0 w-4 cursor-move pointer-events-auto"
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => !isDragging && setIsHovering(false)}
      />
      {/* 右边框 */}
      <div
        className="absolute top-0 -right-2 bottom-0 w-4 cursor-move pointer-events-auto"
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => !isDragging && setIsHovering(false)}
      />
      
      {/* 选中数量标签 */}
      <div 
        className={cn(
          'absolute -top-6 left-1/2 -translate-x-1/2',
          'px-2 py-0.5 rounded text-xs font-medium',
          'bg-blue-500 text-white shadow-sm',
          'pointer-events-none'
        )}
      >
        {selectedNodes.length} nodes
      </div>
    </div>
  )
}

// ============ 辅助函数 ============

function calculateBounds(
  nodes: Node[],
  nodeWidth: number,
  nodeHeight: number,
  padding: number
): { x: number; y: number; width: number; height: number } {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + nodeWidth)
    maxY = Math.max(maxY, node.position.y + nodeHeight)
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }
}

export const SelectionBoundingBox = memo(SelectionBoundingBoxComponent)
export default SelectionBoundingBox
