/**
 * 节点创建 Popover
 * 点击节点底部 Output Handle 时弹出，支持创建 User 或 Assistant 节点
 * 从节点右侧弹出
 */

import { memo, useCallback, useState, useRef, useEffect } from 'react'
import { Portal, Button, Textarea, Flex, Text, Divider, Tooltip, Paper } from '@mantine/core'
import { IconUser, IconRobot, IconSend, IconKeyboard, IconX } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

import type { Message, Session } from 'src/shared/types'

export interface NodeCreatePopoverProps {
  /** 是否打开 */
  opened: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 目标元素 */
  target: HTMLElement | null
  /** 当前节点消息 */
  message: Message
  /** 当前会话 */
  session: Session
  /** 是否为叶子节点（决定是延续还是分支） */
  isLeafNode: boolean
  /** 创建 User 节点回调 */
  onCreateUserNode: (content: string, targetMessageId: string) => void
  /** 创建 Assistant 节点回调（触发 AI 生成） */
  onCreateAssistantNode: (targetMessageId: string) => void
  /** 使用底部输入框回调 */
  onUseBottomInput: (targetMessageId: string) => void
}

function NodeCreatePopoverComponent({
  opened,
  onClose,
  target,
  message,
  isLeafNode,
  onCreateUserNode,
  onCreateAssistantNode,
  onUseBottomInput,
}: NodeCreatePopoverProps) {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState('')
  const [mode, setMode] = useState<'select' | 'input'>('select')
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // 计算弹出位置（从节点右侧弹出）
  useEffect(() => {
    if (opened && target) {
      const rect = target.getBoundingClientRect()
      // 找到节点容器（向上查找带有 data-id 的元素）
      let nodeElement = target.parentElement
      while (nodeElement && !nodeElement.getAttribute('data-id')) {
        nodeElement = nodeElement.parentElement
      }
      
      if (nodeElement) {
        const nodeRect = nodeElement.getBoundingClientRect()
        // 从节点右侧弹出，垂直居中于节点
        setPosition({
          top: nodeRect.top + nodeRect.height / 2,
          left: nodeRect.right + 12, // 12px 间距
        })
      } else {
        // 回退：从 Handle 右侧弹出
        setPosition({
          top: rect.top + rect.height / 2,
          left: rect.right + 12,
        })
      }
    }
  }, [opened, target])

  // 重置状态
  useEffect(() => {
    if (opened) {
      setInputValue('')
      setMode('select')
    }
  }, [opened])

  // 聚焦输入框
  useEffect(() => {
    if (mode === 'input' && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [mode])

  // 点击外部关闭
  useEffect(() => {
    if (!opened) return

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // 延迟添加监听，避免立即关闭
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [opened, onClose])

  // 处理创建 User 节点
  const handleCreateUser = useCallback(() => {
    setMode('input')
  }, [])

  // 处理发送消息
  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return
    onCreateUserNode(inputValue.trim(), message.id)
    setInputValue('')
    onClose()
  }, [inputValue, message.id, onCreateUserNode, onClose])

  // 处理创建 Assistant 节点
  const handleCreateAssistant = useCallback(() => {
    onCreateAssistantNode(message.id)
    onClose()
  }, [message.id, onCreateAssistantNode, onClose])

  // 处理使用底部输入框
  const handleUseBottomInput = useCallback(() => {
    onUseBottomInput(message.id)
    onClose()
  }, [message.id, onUseBottomInput, onClose])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      if (mode === 'input') {
        setMode('select')
      } else {
        onClose()
      }
    }
  }, [handleSend, mode, onClose])

  // 是否可以创建 Assistant 节点（只有 User 节点后才能创建）
  const canCreateAssistant = message.role === 'user'

  // 操作描述
  const actionDescription = isLeafNode 
    ? t('Continue conversation') 
    : t('Create new branch')

  if (!opened || !target) return null

  return (
    <Portal>
      <Paper
        ref={popoverRef}
        shadow="lg"
        radius="md"
        p="sm"
        className="fixed z-[1000] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        style={{
          top: position.top,
          left: position.left,
          transform: 'translateY(-50%)',
          width: 280,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧箭头 */}
        <div 
          className="absolute w-0 h-0 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-gray-200 dark:border-r-gray-700"
          style={{ left: -8, top: '50%', transform: 'translateY(-50%)' }}
        />
        <div 
          className="absolute w-0 h-0 border-t-[7px] border-b-[7px] border-r-[7px] border-t-transparent border-b-transparent border-r-white dark:border-r-gray-800"
          style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }}
        />

        {mode === 'select' ? (
          <Flex direction="column" gap="xs">
            <Flex justify="space-between" align="center">
              <Text size="xs" c="dimmed">
                {actionDescription}
              </Text>
              <Button
                variant="subtle"
                size="compact-xs"
                color="gray"
                onClick={onClose}
                p={2}
              >
                <IconX size={14} />
              </Button>
            </Flex>
            
            <Divider />

            {/* 创建 User 节点 */}
            <Button
              variant="light"
              color="blue"
              leftSection={<IconUser size={18} />}
              fullWidth
              onClick={handleCreateUser}
            >
              {t('Add User Message')}
            </Button>

            {/* 创建 Assistant 节点 */}
            <Tooltip
              label={t('Only available after User message')}
              disabled={canCreateAssistant}
              withArrow
            >
              <Button
                variant="light"
                color="green"
                leftSection={<IconRobot size={18} />}
                fullWidth
                disabled={!canCreateAssistant}
                onClick={handleCreateAssistant}
              >
                {t('Generate AI Response')}
              </Button>
            </Tooltip>

            <Divider label={t('or')} labelPosition="center" />

            {/* 使用底部输入框 */}
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconKeyboard size={18} />}
              fullWidth
              onClick={handleUseBottomInput}
            >
              {t('Use Main Input')}
            </Button>
          </Flex>
        ) : (
          <Flex direction="column" gap="xs">
            <Flex justify="space-between" align="center">
              <Text size="xs" c="dimmed">
                {t('Enter your message')}
              </Text>
              <Button
                variant="subtle"
                size="compact-xs"
                color="gray"
                onClick={onClose}
                p={2}
              >
                <IconX size={14} />
              </Button>
            </Flex>

            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('Type your message...')}
              minRows={2}
              maxRows={6}
              autosize
            />

            <Flex justify="space-between" align="center">
              <Button
                variant="subtle"
                size="xs"
                color="gray"
                onClick={() => setMode('select')}
              >
                {t('Back')}
              </Button>

              <Button
                size="xs"
                color="blue"
                rightSection={<IconSend size={14} />}
                disabled={!inputValue.trim()}
                onClick={handleSend}
              >
                {t('Send')}
              </Button>
            </Flex>
          </Flex>
        )}
      </Paper>
    </Portal>
  )
}

export const NodeCreatePopover = memo(NodeCreatePopoverComponent)
export default NodeCreatePopover
