/**
 * 节点悬浮操作按钮栏
 * 鼠标悬浮节点时显示在节点底部
 */

import { memo, useCallback, useState } from 'react'
import { ActionIcon, Tooltip, Flex, Paper } from '@mantine/core'
import {
  IconCopy,
  IconPencil,
  IconQuote,
  IconTrash,
  IconReload,
  IconPlus,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import NiceModal from '@ebay/nice-modal-react'

import type { Message, Session } from 'src/shared/types'
import { getMessageText } from 'src/shared/utils/message'
import { copyToClipboard } from '@/packages/navigator'
import * as toastActions from '@/stores/toastActions'
import { useUIStore } from '@/stores/uiStore'
import { useMultiModelStore } from '@/stores/multiModelStore'
import { regenerateInNewFork, removeMessage } from '@/stores/sessionActions'
import { cn } from '@/lib/utils'

export interface NodeActionBarProps {
  message: Message
  session: Session
  nodeType: 'system' | 'user' | 'assistant'
  className?: string
  onCreateNode?: () => void
  onViewDetail?: () => void
}

function NodeActionBarComponent({
  message,
  session,
  nodeType,
  className,
  onCreateNode,
  onViewDetail,
}: NodeActionBarProps) {
  const { t } = useTranslation()
  const setQuote = useUIStore((state) => state.setQuote)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // 多模型配置
  const multiModelEnabled = useMultiModelStore((s) => s.multiModelEnabled)
  const selectedModels = useMultiModelStore((s) => s.selectedModels)

  // 复制消息
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    copyToClipboard(getMessageText(message, true, false))
    toastActions.add(t('copied to clipboard'), 2000)
  }, [message, t])

  // 引用消息
  const handleQuote = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const input = getMessageText(message)
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
    setQuote(input + '\n\n-------------------\n\n')
    toastActions.add(t('Quote added to input'), 2000)
  }, [message, setQuote, t])

  // 编辑消息
  const handleEdit = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    await NiceModal.show('message-edit', { sessionId: session.id, msg: message })
  }, [message, session.id])

  // 重新生成
  const handleRegenerate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const multiModels = multiModelEnabled && selectedModels.length > 0 ? selectedModels : undefined
    regenerateInNewFork(session.id, message, { multiModels })
  }, [message, session.id, multiModelEnabled, selectedModels])

  // 删除消息
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDeleting) {
      // 第二次点击确认删除
      removeMessage(session.id, message.id)
      setIsDeleting(false)
    } else {
      // 第一次点击进入确认状态
      setIsDeleting(true)
      // 3秒后重置状态
      setTimeout(() => setIsDeleting(false), 3000)
    }
  }, [message.id, session.id, isDeleting])

  // 创建新节点
  const handleCreate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onCreateNode?.()
  }, [onCreateNode])

  return (
    <Paper
      shadow="sm"
      radius="md"
      p={4}
      className={cn(
        'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Flex gap={2}>
        {/* 复制 */}
        <Tooltip label={t('copy')} withArrow openDelay={500}>
          <ActionIcon
            variant="subtle"
            size="sm"
            color="gray"
            onClick={handleCopy}
          >
            <IconCopy size={16} />
          </ActionIcon>
        </Tooltip>

        {/* 引用 */}
        <Tooltip label={t('quote')} withArrow openDelay={500}>
          <ActionIcon
            variant="subtle"
            size="sm"
            color="gray"
            onClick={handleQuote}
          >
            <IconQuote size={16} />
          </ActionIcon>
        </Tooltip>

        {/* 编辑（非 System 节点） */}
        {nodeType !== 'system' && (
          <Tooltip label={t('edit')} withArrow openDelay={500}>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray"
              onClick={handleEdit}
            >
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
        )}

        {/* 重新生成（仅 Assistant 节点） */}
        {nodeType === 'assistant' && (
          <Tooltip label={t('Reply Again')} withArrow openDelay={500}>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="green"
              onClick={handleRegenerate}
            >
              <IconReload size={16} />
            </ActionIcon>
          </Tooltip>
        )}

        {/* 创建新节点 */}
        {onCreateNode && (
          <Tooltip label={t('Create Node')} withArrow openDelay={500}>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="blue"
              onClick={handleCreate}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </Tooltip>
        )}

        {/* 删除 */}
        <Tooltip 
          label={isDeleting ? t('Click again to confirm') : t('delete')} 
          withArrow 
          openDelay={500}
          color={isDeleting ? 'red' : undefined}
        >
          <ActionIcon
            variant={isDeleting ? 'filled' : 'subtle'}
            size="sm"
            color="red"
            onClick={handleDelete}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      </Flex>
    </Paper>
  )
}

export const NodeActionBar = memo(NodeActionBarComponent)
export default NodeActionBar
