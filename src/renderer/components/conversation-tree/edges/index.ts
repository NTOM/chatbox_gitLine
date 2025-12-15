/**
 * 边组件导出
 */

export { ActivePathEdge } from './ActivePathEdge'
export { BranchEdge } from './BranchEdge'
export { DefaultEdge } from './DefaultEdge'

import { ActivePathEdge } from './ActivePathEdge'
import { BranchEdge } from './BranchEdge'
import { DefaultEdge } from './DefaultEdge'

/**
 * ReactFlow 边类型映射
 */
export const edgeTypes = {
  activePath: ActivePathEdge,
  branch: BranchEdge,
  default: DefaultEdge,
}
