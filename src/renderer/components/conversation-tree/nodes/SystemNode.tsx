/**
 * 系统提示节点
 */

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { IconSettings } from '@tabler/icons-react'
import type { TreeNodeData } from '@/lib/conversation-tree-adapter'
import { getMessagePreviewText } from '@/lib/conversation-tree-adapter'
import { cn } from '@/lib/utils'

type SystemNodeProps = {
  data: TreeNodeData
  selected?: boolean
}

function SystemNodeComponent({ data, selected: _rfSelected }: SystemNodeProps) {
  const previewText = getMessagePreviewText(data.message, 80)
  
  // 使用我们自己管理的选中状态，而不是 ReactFlow 的 selected
  const isSelected = data.isSelected ?? false

  return (
    <div
      className={cn(
        'w-[260px] rounded-lg border-2 border-dashed p-3 transition-all',
        'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600',
        data.isActivePath && 'ring-2 ring-blue-400 ring-offset-2',
        isSelected && 'border-gray-500'
      )}
      style={isSelected ? {
        boxShadow: '0 0 20px 4px rgba(107, 114, 128, 0.5), 0 0 40px 8px rgba(107, 114, 128, 0.25)',
        animation: 'node-glow-pulse 2s ease-in-out infinite',
      } : undefined}
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
