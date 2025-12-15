/**
 * 目标节点选择器
 * 用于在底部输入框中选择要从哪个节点后创建新消息
 */

import { memo, useCallback, useMemo, useState } from 'react'
import { Button, Menu, Text, Flex, Badge, ScrollArea } from '@mantine/core'
import { IconTarget, IconChevronDown, IconX, IconGitBranch } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

import type { Session, Message } from 'src/shared/types'
import { getMessageText } from 'src/shared/utils/message'
import { cn } from '@/lib/utils'

export interface TargetNodeSelectorProps {
  session: Session
  /** 当前选中的目标节点 ID，null 表示使用默认（活跃分支末尾） */
  targetNodeId: string | null
  /** 选择目标节点回调 */
  onSelectTarget: (nodeId: string | null) => void
  className?: string
}

function TargetNodeSelectorComponent({
  session,
  targetNodeId,
  onSelectTarget,
  className,
}: TargetNodeSelectorProps) {
  const { t } = useTranslation()
  const [opened, setOpened] = useState(false)

  // 获取所有可选的目标节点（叶子节点或有分支的节点）
  const selectableNodes = useMemo(() => {
    const nodes: Array<{
      id: string
      message: Message
      isLeaf: boolean
      depth: number
    }> = []

    // 简化实现：只显示最近的几条消息作为可选目标
    const messages = session.messages
    const recentMessages = messages.slice(-10) // 最近10条消息

    recentMessages.forEach((msg, index) => {
      if (msg.role !== 'system') {
        nodes.push({
          id: msg.id,
          message: msg,
          isLeaf: index === recentMessages.length - 1,
          depth: index,
        })
      }
    })

    return nodes.reverse() // 最新的在前面
  }, [session.messages])

  // 获取选中节点的信息
  const selectedNode = useMemo(() => {
    if (!targetNodeId) return null
    return selectableNodes.find((n) => n.id === targetNodeId)
  }, [targetNodeId, selectableNodes])

  // 获取消息预览文本
  const getPreviewText = useCallback((message: Message, maxLength = 30) => {
    const text = getMessageText(message)
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }, [])

  // 清除选择
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectTarget(null)
  }, [onSelectTarget])

  // 选择节点
  const handleSelect = useCallback((nodeId: string) => {
    onSelectTarget(nodeId)
    setOpened(false)
  }, [onSelectTarget])

  if (selectableNodes.length === 0) {
    return null
  }

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      position="top-start"
      offset={8}
      width={300}
    >
      <Menu.Target>
        <Button
          variant={targetNodeId ? 'light' : 'subtle'}
          color={targetNodeId ? 'blue' : 'gray'}
          size="xs"
          leftSection={<IconTarget size={14} />}
          rightSection={
            targetNodeId ? (
              <IconX
                size={14}
                className="cursor-pointer hover:text-red-500"
                onClick={handleClear}
              />
            ) : (
              <IconChevronDown size={14} />
            )
          }
          className={cn('transition-all', className)}
        >
          {targetNodeId ? (
            <Text size="xs" truncate maw={120}>
              {selectedNode ? getPreviewText(selectedNode.message, 15) : t('Selected')}
            </Text>
          ) : (
            t('Target Node')
          )}
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>{t('Select target node')}</Menu.Label>
        <Menu.Divider />

        <Menu.Item
          leftSection={<IconGitBranch size={16} />}
          onClick={() => handleSelect('')}
          color={!targetNodeId ? 'blue' : undefined}
        >
          <Flex justify="space-between" align="center">
            <Text size="sm">{t('Default (Active Branch End)')}</Text>
            {!targetNodeId && <Badge size="xs" color="blue">{t('Current')}</Badge>}
          </Flex>
        </Menu.Item>

        <Menu.Divider />
        <Menu.Label>{t('Recent Messages')}</Menu.Label>

        <ScrollArea.Autosize mah={200}>
          {selectableNodes.map((node) => (
            <Menu.Item
              key={node.id}
              onClick={() => handleSelect(node.id)}
              color={targetNodeId === node.id ? 'blue' : undefined}
            >
              <Flex direction="column" gap={2}>
                <Flex justify="space-between" align="center">
                  <Badge
                    size="xs"
                    color={node.message.role === 'user' ? 'blue' : 'green'}
                    variant="light"
                  >
                    {node.message.role === 'user' ? 'User' : 'AI'}
                  </Badge>
                  {node.isLeaf && (
                    <Badge size="xs" color="gray" variant="outline">
                      {t('Leaf')}
                    </Badge>
                  )}
                </Flex>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {getPreviewText(node.message)}
                </Text>
              </Flex>
            </Menu.Item>
          ))}
        </ScrollArea.Autosize>
      </Menu.Dropdown>
    </Menu>
  )
}

export const TargetNodeSelector = memo(TargetNodeSelectorComponent)
export default TargetNodeSelector
