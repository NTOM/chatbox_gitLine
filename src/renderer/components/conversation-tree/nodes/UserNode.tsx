/**
 * 用户消息节点
 */

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { IconUser, IconGitBranch } from '@tabler/icons-react'
import type { TreeNodeData } from '@/lib/conversation-tree-adapter'
import { getMessagePreviewText } from '@/lib/conversation-tree-adapter'
import { getBranchColor } from '../utils/branchColors'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'

type UserNodeProps = {
  data: TreeNodeData
  selected?: boolean
}

function UserNodeComponent({ data, selected }: UserNodeProps) {
  const previewText = getMessagePreviewText(data.message, 100)
  const timestamp = data.message.timestamp
    ? dayjs(data.message.timestamp).format('HH:mm')
    : ''
  
  const isBranch = data.branchCount > 1
  const branchColor = isBranch ? getBranchColor(data.branchIndex) : null

  return (
    <div
      className={cn(
        'w-[260px] rounded-lg border-2 p-3 transition-all',
        'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700',
        data.isActivePath && 'ring-2 ring-blue-400 ring-offset-2',
        !data.isActivePath && 'opacity-60',
        selected && 'border-blue-500 shadow-lg'
      )}
      style={isBranch && !data.isActivePath ? {
        borderColor: branchColor?.border,
        backgroundColor: branchColor?.bg,
      } : undefined}
    >
      {/* 顶部连接点 */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-400 !w-3 !h-3"
        style={isBranch && !data.isActivePath ? { backgroundColor: branchColor?.border } : undefined}
      />

      {/* 头部 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
            <IconUser size={14} className="text-white" />
          </div>
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            You
          </span>
        </div>
        {timestamp && (
          <span className="text-xs text-gray-400">{timestamp}</span>
        )}
      </div>

      {/* 内容预览 */}
      <div className="text-sm text-gray-700 dark:text-gray-200 line-clamp-3">
        {previewText || '(Empty message)'}
      </div>

      {/* 附件指示 */}
      {(data.message.files?.length || data.message.links?.length) && (
        <div className="mt-2 flex items-center gap-1 text-xs text-blue-500">
          📎 {(data.message.files?.length || 0) + (data.message.links?.length || 0)} attachments
        </div>
      )}

      {/* 分支指示器 */}
      {isBranch && (
        <div 
          className="mt-2 text-xs flex items-center gap-1 font-medium"
          style={{ color: branchColor?.text }}
        >
          <IconGitBranch size={12} />
          Branch {data.branchIndex + 1}/{data.branchCount}
        </div>
      )}

      {/* 底部连接点 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-400 !w-3 !h-3"
        style={isBranch && !data.isActivePath ? { backgroundColor: branchColor?.border } : undefined}
      />
    </div>
  )
}

export const UserNode = memo(UserNodeComponent)
