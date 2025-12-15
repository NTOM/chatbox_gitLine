/**
 * 节点组件导出
 */

export { SystemNode } from './SystemNode'
export { UserNode } from './UserNode'
export { AssistantNode } from './AssistantNode'

import { SystemNode } from './SystemNode'
import { UserNode } from './UserNode'
import { AssistantNode } from './AssistantNode'

/**
 * ReactFlow 节点类型映射
 */
export const nodeTypes = {
  system: SystemNode,
  user: UserNode,
  assistant: AssistantNode,
}
