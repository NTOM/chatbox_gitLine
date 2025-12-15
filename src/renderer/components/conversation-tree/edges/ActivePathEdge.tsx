/**
 * 活跃路径边组件
 * 用于显示当前活跃对话分支的连线
 */

import { memo } from 'react'
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react'

interface ActivePathEdgeData {
  isActivePath: boolean
}

function ActivePathEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps<ActivePathEdgeData>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  })

  return (
    <>
      {/* 发光效果层 */}
      <BaseEdge
        path={edgePath}
        style={{
          stroke: '#22c55e',
          strokeWidth: 6,
          opacity: 0.3,
          filter: 'blur(3px)',
        }}
      />
      {/* 主线条 */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: '#22c55e',
          strokeWidth: 3,
          strokeLinecap: 'round',
        }}
      />
      {/* 动画流动效果 */}
      <path
        d={edgePath}
        fill="none"
        stroke="#4ade80"
        strokeWidth={2}
        strokeDasharray="8 8"
        strokeLinecap="round"
        className="animate-flow"
        style={{
          animation: 'flowAnimation 1s linear infinite',
        }}
      />
      {/* 添加 CSS 动画 */}
      <style>
        {`
          @keyframes flowAnimation {
            0% {
              stroke-dashoffset: 16;
            }
            100% {
              stroke-dashoffset: 0;
            }
          }
        `}
      </style>
    </>
  )
}

export const ActivePathEdge = memo(ActivePathEdgeComponent)
