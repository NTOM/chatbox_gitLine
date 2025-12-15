/**
 * 分支边组件
 * 用于显示非活跃分支的连线，使用虚线和不同颜色区分
 */

import { memo } from 'react'
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react'
import { getBranchBorderColor } from '../utils/branchColors'

interface BranchEdgeData {
  isActivePath: boolean
  branchIndex?: number
}

function BranchEdgeComponent({
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
}: EdgeProps<BranchEdgeData>) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  })

  const branchIndex = data?.branchIndex ?? 0
  const color = getBranchBorderColor(branchIndex)

  return (
    <>
      {/* 虚线边 */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: '6 4',
          strokeLinecap: 'round',
          opacity: 0.7,
        }}
      />
    </>
  )
}

export const BranchEdge = memo(BranchEdgeComponent)
