/**
 * 系统提示节点
 */

import { memo } from 'react'
import { Handle, Position, type Node } from '@xyflow/react'
import { IconSettings } from '@tabler/icons-react'
import type { TreeNodeData } from '@/lib/conversation-tree-adapter'
import { getMessagePreviewText } from '@/lib/conversation-tree-adapter'
import { cn } from '@/lib/utils'

type SystemNodeProps = {
  data: TreeNodeData
  selected?: boolean
}

function SystemNodeComponent({ data, selected }: SystemNodeProps) {
  const previewText = getMessagePreviewText(data.message, 80)

  return (
    <div
      className={cn(
        'w-[260px] rounded-lg border-2 border-dashed p-3 transition-all',
        'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600',
        data.isActivePath && 'ring-2 ring-blue-400 ring-offset-2',
        selected && 'border-blue-500 shadow-lg'
      )}
    >
      {/* 顶部连接点 */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-3 !h-3"
      />

      {/* 头部 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-gray-400 dark:bg-gray-600 flex items-center justify-center">
          <IconSettings size={14} className="text-white" />
        </div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          System Prompt
        </span>
      </div>

      {/* 内容预览 */}
      <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 italic">
        {previewText || '(Empty system prompt)'}
      </div>

      {/* 底部连接点 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400 !w-3 !h-3"
      />
    </div>
  )
}

export const SystemNode = memo(SystemNodeComponent)
