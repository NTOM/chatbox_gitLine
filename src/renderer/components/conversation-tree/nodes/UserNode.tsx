/**
 * 用户消息节点
 */

import { memo, useState, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import { IconUser, IconGitBranch, IconCopy, IconPencil, IconQuote, IconTrash, IconSwitchHorizontal } from '@tabler/icons-react'
import { ActionIcon, Tooltip, Flex, Paper } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import NiceModal from '@ebay/nice-modal-react'

import type { TreeNodeData } from '@/lib/conversation-tree-adapter'
import { getMessagePreviewText } from '@/lib/conversation-tree-adapter'
import { getBranchColor } from '../utils/branchColors'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'
import { getMessageText } from 'src/shared/utils/message'
import { copyToClipboard } from '@/packages/navigator'
import * as toastActions from '@/stores/toastActions'
import { useUIStore } from '@/stores/uiStore'
import { removeMessage, switchToMessageBranch } from '@/stores/sessionActions'

type UserNodeProps = {
  data: TreeNodeData
  selected?: boolean
}

function UserNodeComponent({ data, selected }: UserNodeProps) {
  const { t } = useTranslation()
  const [isHovered, setIsHovered] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const setQuote = useUIStore((state) => state.setQuote)
  
  const previewText = getMessagePreviewText(data.message, 100)
  const timestamp = data.message.timestamp
    ? dayjs(data.message.timestamp).format('HH:mm')
    : ''
  
  const isBranch = data.branchCount > 1
  const branchColor = isBranch ? getBranchColor(data.branchIndex) : null

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setIsDeleting(false)
  }, [])

  // 复制消息
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    copyToClipboard(getMessageText(data.message, true, false))
    toastActions.add(t('copied to clipboard'), 2000)
  }, [data.message, t])

  // 引用消息
  const handleQuote = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const input = getMessageText(data.message)
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
    setQuote(input + '\n\n')
    toastActions.add(t('Quote added to input'), 2000)
  }, [data.message, setQuote, t])

  // 编辑消息
  const handleEdit = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    await NiceModal.show('message-edit', { sessionId: data.sessionId, msg: data.message })
  }, [data.message, data.sessionId])

  // 删除消息 - 在所有分支都有效
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDeleting) {
      removeMessage(data.sessionId, data.message.id)
      setIsDeleting(false)
    } else {
      setIsDeleting(true)
      setTimeout(() => setIsDeleting(false), 3000)
    }
  }, [data.sessionId, data.message.id, isDeleting])

  // 切换到此分支
  const handleSwitchToBranch = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // 直接切换到包含此消息的分支
    switchToMessageBranch(data.sessionId, data.message.id)
  }, [data.sessionId, data.message.id])

  // 点击 Handle 创建节点
  const handleSourceClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // 触发自定义事件，由父组件处理
    const event = new CustomEvent('node-handle-click', {
      bubbles: true,
      detail: { nodeId: data.message.id, nodeType: 'user', element: e.currentTarget }
    })
    e.currentTarget.dispatchEvent(event)
  }, [data.message.id])

  return (
    <div
      className={cn(
        'w-[260px] rounded-lg border-2 p-3 transition-all relative group',
        'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700',
        data.isActivePath && 'ring-2 ring-blue-400 ring-offset-2',
        !data.isActivePath && 'opacity-60',
        selected && 'border-blue-500 shadow-lg',
        isHovered && 'shadow-md'
      )}
      style={isBranch && !data.isActivePath ? {
        borderColor: branchColor?.border,
        backgroundColor: branchColor?.bg,
      } : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 底部透明扩展区域 - 桥接节点和悬浮操作栏之间的空隙 */}
      {isHovered && (
        <div 
          className="absolute -bottom-12 left-0 right-0 h-14"
          style={{ pointerEvents: 'auto' }}
        />
      )}
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

      {/* 悬浮操作按钮栏 */}
      {isHovered && (
        <Paper
          shadow="sm"
          radius="md"
          p={4}
          className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-[100]"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{ pointerEvents: 'auto' }}
        >
          <Flex gap={2}>
            {/* 非当前分支时显示切换按钮 */}
            {!data.isActivePath && isBranch && (
              <Tooltip label={t('Switch to this branch')} withArrow openDelay={300}>
                <ActionIcon variant="light" size="sm" color="violet" onClick={handleSwitchToBranch}>
                  <IconSwitchHorizontal size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label={t('copy')} withArrow openDelay={300}>
              <ActionIcon variant="subtle" size="sm" color="gray" onClick={handleCopy}>
                <IconCopy size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('quote')} withArrow openDelay={300}>
              <ActionIcon variant="subtle" size="sm" color="gray" onClick={handleQuote}>
                <IconQuote size={16} />
              </ActionIcon>
            </Tooltip>
            {data.isActivePath && (
              <Tooltip label={t('edit')} withArrow openDelay={300}>
                <ActionIcon variant="subtle" size="sm" color="gray" onClick={handleEdit}>
                  <IconPencil size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label={isDeleting ? t('Click again to confirm') : t('delete')} withArrow openDelay={300} color={isDeleting ? 'red' : undefined}>
              <ActionIcon variant={isDeleting ? 'filled' : 'subtle'} size="sm" color="red" onClick={handleDelete}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Flex>
        </Paper>
      )}

      {/* 底部连接点 - 可点击创建新节点 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(
          '!w-4 !h-4 !bg-blue-400 transition-all cursor-pointer',
          'hover:!w-6 hover:!h-6 hover:!bg-blue-500',
          isHovered && '!w-5 !h-5'
        )}
        style={isBranch && !data.isActivePath ? { backgroundColor: branchColor?.border } : undefined}
        id="source-handle"
        onClick={handleSourceClick}
      />
    </div>
  )
}

export const UserNode = memo(UserNodeComponent)
