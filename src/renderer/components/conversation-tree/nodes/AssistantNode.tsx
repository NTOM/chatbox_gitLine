/**
 * AI 助手消息节点
 */

import { memo } from 'react'
import { Handle, Position, type Node } from '@xyflow/react'
import { IconRobot, IconLoader2 } from '@tabler/icons-react'
import type { TreeNodeData } from '@/lib/conversation-tree-adapter'
import { getMessagePreviewText } from '@/lib/conversation-tree-adapter'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'

type AssistantNodeProps = {
  data: TreeNodeData
  selected?: boolean
}

function AssistantNodeComponent({ data, selected }: AssistantNodeProps) {
  const previewText = getMessagePreviewText(data.message, 100)
  const timestamp = data.message.timestamp
    ? dayjs(data.message.timestamp).format('HH:mm')
    : ''
  const isGenerating = data.message.generating
  const hasError = !!data.message.error

  return (
    <div
      className={cn(
        'w-[260px] rounded-lg border-2 p-3 transition-all',
        'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700',
        data.isActivePath && 'ring-2 ring-green-400 ring-offset-2',
        !data.isActivePath && 'opacity-60',
        hasError && 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30',
        selected && 'border-green-500 shadow-lg'
      )}
    >
      {/* 顶部连接点 */}
      <Handle
        type="target"
        position={Position.Top}
        className={cn('!w-3 !h-3', hasError ? '!bg-red-400' : '!bg-green-400')}
      />

      {/* 头部 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center',
              hasError ? 'bg-red-500' : 'bg-green-500'
            )}
          >
            {isGenerating ? (
              <IconLoader2 size={14} className="text-white animate-spin" />
            ) : (
              <IconRobot size={14} className="text-white" />
            )}
          </div>
          <span
            className={cn(
              'text-xs font-medium',
              hasError
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            )}
          >
            {data.message.model || 'Assistant'}
          </span>
        </div>
        {timestamp && (
          <span className="text-xs text-gray-400">{timestamp}</span>
        )}
      </div>

      {/* 内容预览 */}
      <div
        className={cn(
          'text-sm line-clamp-3',
          hasError
            ? 'text-red-600 dark:text-red-300'
            : 'text-gray-700 dark:text-gray-200'
        )}
      >
        {isGenerating ? (
          <span className="italic text-gray-400">Generating...</span>
        ) : hasError ? (
          <span>⚠️ {data.message.error}</span>
        ) : (
          previewText || '(Empty response)'
        )}
      </div>

      {/* Token 使用信息 */}
      {data.message.usage?.totalTokens && (
        <div className="mt-2 text-xs text-gray-400">
          🎯 {data.message.usage.totalTokens} tokens
        </div>
      )}

      {/* 分支指示器 */}
      {data.branchCount > 1 && (
        <div className="mt-2 text-xs text-orange-500 flex items-center gap-1">
          🔀 Branch {data.branchIndex + 1}/{data.branchCount}
        </div>
      )}

      {/* 子分支指示器 */}
      {data.childrenCount > 1 && (
        <div className="mt-1 text-xs text-purple-500 flex items-center gap-1">
          🌿 {data.childrenCount} branches below
        </div>
      )}

      {/* 底部连接点 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn('!w-3 !h-3', hasError ? '!bg-red-400' : '!bg-green-400')}
      />
    </div>
  )
}

export const AssistantNode = memo(AssistantNodeComponent)
