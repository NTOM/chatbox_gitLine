/**
 * 默认边组件
 * 用于显示普通连线
 */

import { memo } from 'react'
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react'

interface DefaultEdgeData {
  isActivePath?: boolean
}

function DefaultEdgeComponent({
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
}: EdgeProps<DefaultEdgeData>) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  })

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        stroke: '#9ca3af',
        strokeWidth: 2,
        strokeLinecap: 'round',
        opacity: 0.5,
      }}
    />
  )
}

export const DefaultEdge = memo(DefaultEdgeComponent)
