/**
 * 消息详情抽屉组件
 * 点击节点后在右侧显示完整消息内容
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Drawer, Text, Flex, ActionIcon, Tooltip, ScrollArea, Badge, Divider } from '@mantine/core'
import {
  IconX,
  IconCopy,
  IconPencil,
  IconReload,
  IconTrash,
  IconQuote,
  IconRobot,
  IconUser,
  IconSettings,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import NiceModal from '@ebay/nice-modal-react'
import dayjs from 'dayjs'

import type { Message, Session } from 'src/shared/types'
import { getMessageText } from 'src/shared/utils/message'
import Markdown from '@/components/Markdown'
import { BlockCodeCollapsedStateProvider } from '@/components/Markdown'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { useMultiModelStore } from '@/stores/multiModelStore'
import { copyToClipboard } from '@/packages/navigator'
import * as toastActions from '@/stores/toastActions'
import { regenerateInNewFork, removeMessage } from '@/stores/sessionActions'
import { cn } from '@/lib/utils'

import TextSelectionQuote from './TextSelectionQuote'

export interface MessageDetailDrawerProps {
  opened: boolean
  onClose: () => void
  message: Message | null
  session: Session | null
  onQuote?: (quotedText: string) => void
}

export function MessageDetailDrawer({
  opened,
  onClose,
  message,
  session,
  onQuote,
}: MessageDetailDrawerProps) {
  const { t } = useTranslation()
  const contentRef = useRef<HTMLDivElement>(null)
  const {
    enableMarkdownRendering,
    enableLaTeXRendering,
    enableMermaidRendering,
    showTokenCount,
    showWordCount,
  } = useSettingsStore()
  const setQuote = useUIStore((state) => state.setQuote)
  
  // 多模型配置
  const multiModelEnabled = useMultiModelStore((s) => s.multiModelEnabled)
  const selectedModels = useMultiModelStore((s) => s.selectedModels)

  // 获取消息文本内容
  const messageText = useMemo(() => {
    if (!message) return ''
    return getMessageText(message)
  }, [message])

  // 格式化时间戳
  const formattedTime = useMemo(() => {
    if (!message?.timestamp) return ''
    return dayjs(message.timestamp).format('YYYY-MM-DD HH:mm:ss')
  }, [message?.timestamp])

  // 复制消息
  const handleCopy = useCallback(() => {
    if (!message) return
    copyToClipboard(getMessageText(message, true, false))
    toastActions.add(t('copied to clipboard'), 2000)
  }, [message, t])

  // 引用消息
  const handleQuote = useCallback(() => {
    if (!message) return
    const input = getMessageText(message)
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
    setQuote(input + '\n\n-------------------\n\n')
    onClose()
  }, [message, setQuote, onClose])

  // 编辑消息
  const handleEdit = useCallback(async () => {
    if (!message || !session) return
    await NiceModal.show('message-edit', { sessionId: session.id, msg: message })
    onClose()
  }, [message, session, onClose])

  // 重新生成
  const handleRegenerate = useCallback(() => {
    if (!message || !session) return
    const multiModels = multiModelEnabled && selectedModels.length > 0 ? selectedModels : undefined
    regenerateInNewFork(session.id, message, { multiModels })
    onClose()
  }, [message, session, onClose, multiModelEnabled, selectedModels])

  // 删除消息
  const handleDelete = useCallback(() => {
    if (!message || !session) return
    removeMessage(session.id, message.id)
    onClose()
  }, [message, session, onClose])

  // 处理文本选中引用
  const handleTextSelectionQuote = useCallback((quotedText: string) => {
    if (onQuote) {
      onQuote(quotedText)
    } else {
      // 默认行为：添加到输入框
      const formattedQuote = quotedText
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
      setQuote(formattedQuote + '\n\n')
    }
    onClose()
  }, [onQuote, setQuote, onClose])

  if (!message) return null

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isSystem = message.role === 'system'

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={
        <Flex align="center" gap="sm">
          {isUser && <IconUser size={20} className="text-blue-500" />}
          {isAssistant && <IconRobot size={20} className="text-green-500" />}
          {isSystem && <IconSettings size={20} className="text-gray-500" />}
          <Text fw={600}>
            {isUser && t('User Message')}
            {isAssistant && (message.model || t('Assistant'))}
            {isSystem && t('System Prompt')}
          </Text>
        </Flex>
      }
      overlayProps={{ backgroundOpacity: 0.3, blur: 2 }}
      closeButtonProps={{ size: 'lg' }}
    >
      <Flex direction="column" h="100%">
        {/* 元信息区域 */}
        <Flex gap="sm" wrap="wrap" mb="md">
          {formattedTime && (
            <Badge variant="light" color="gray" size="sm">
              {formattedTime}
            </Badge>
          )}
          {showWordCount && message.wordCount !== undefined && (
            <Badge variant="light" color="blue" size="sm">
              {message.wordCount} {t('words')}
            </Badge>
          )}
          {showTokenCount && message.tokenCount !== undefined && (
            <Badge variant="light" color="violet" size="sm">
              {message.tokenCount} tokens
            </Badge>
          )}
          {isAssistant && message.usage?.totalTokens && (
            <Badge variant="light" color="green" size="sm">
              {message.usage.totalTokens} tokens used
            </Badge>
          )}
          {isAssistant && message.firstTokenLatency && (
            <Badge variant="light" color="orange" size="sm">
              {message.firstTokenLatency}ms latency
            </Badge>
          )}
        </Flex>

        {/* 操作按钮 */}
        <Flex gap="xs" mb="md">
          <Tooltip label={t('copy')} withArrow>
            <ActionIcon variant="light" onClick={handleCopy}>
              <IconCopy size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('quote')} withArrow>
            <ActionIcon variant="light" onClick={handleQuote}>
              <IconQuote size={18} />
            </ActionIcon>
          </Tooltip>
          {!isSystem && (
            <Tooltip label={t('edit')} withArrow>
              <ActionIcon variant="light" onClick={handleEdit}>
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
          )}
          {isAssistant && (
            <Tooltip label={t('Reply Again')} withArrow>
              <ActionIcon variant="light" color="green" onClick={handleRegenerate}>
                <IconReload size={18} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label={t('delete')} withArrow>
            <ActionIcon variant="light" color="red" onClick={handleDelete}>
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        </Flex>

        <Divider mb="md" />

        {/* 消息内容区域 */}
        <ScrollArea flex={1} offsetScrollbars>
          <div ref={contentRef} className="relative">
            <TextSelectionQuote
              containerRef={contentRef}
              onQuote={handleTextSelectionQuote}
            />
            <BlockCodeCollapsedStateProvider defaultCollapsed={false}>
              {enableMarkdownRendering ? (
                <Markdown
                  uniqueId={message.id}
                  enableLaTeXRendering={enableLaTeXRendering}
                  enableMermaidRendering={enableMermaidRendering}
                  generating={message.generating}
                >
                  {messageText}
                </Markdown>
              ) : (
                <div className="whitespace-pre-wrap break-words">
                  {messageText}
                  {message.generating && (
                    <span className="inline-block w-1.5 h-4 bg-green-500 ml-0.5 animate-pulse align-middle" />
                  )}
                </div>
              )}
            </BlockCodeCollapsedStateProvider>
          </div>
        </ScrollArea>

        {/* 附件区域 */}
        {(message.files?.length || message.links?.length) && (
          <>
            <Divider my="md" />
            <div>
              <Text size="sm" fw={600} mb="xs">
                {t('Attachments')} ({(message.files?.length || 0) + (message.links?.length || 0)})
              </Text>
              <Flex gap="xs" wrap="wrap">
                {message.files?.map((file) => (
                  <Badge key={file.name} variant="outline" size="sm">
                    📎 {file.name}
                  </Badge>
                ))}
                {message.links?.map((link) => (
                  <Badge key={link.url} variant="outline" size="sm">
                    🔗 {link.title}
                  </Badge>
                ))}
              </Flex>
            </div>
          </>
        )}
      </Flex>
    </Drawer>
  )
}

export default MessageDetailDrawer
