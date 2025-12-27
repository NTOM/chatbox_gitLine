/**
 * 多分支提示组件
 * 当存在多个回答分支时，显示提示信息引导用户查看树形视图
 */

import { Alert, Button, Flex, Text } from '@mantine/core'
import { IconGitBranch, IconBinaryTree } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useViewModeStore } from '@/stores/viewModeStore'
import { ScalableIcon } from './ScalableIcon'

interface MultiBranchIndicatorProps {
  /** 分支数量 */
  branchCount: number
  /** 当前分支索引（从0开始） */
  currentBranchIndex: number
  /** 分支切换回调 */
  onSwitchBranch?: (direction: 'prev' | 'next') => void
  /** 是否紧凑模式 */
  compact?: boolean
}

export function MultiBranchIndicator({
  branchCount,
  currentBranchIndex,
  onSwitchBranch,
  compact = false,
}: MultiBranchIndicatorProps) {
  const { t } = useTranslation()
  const setViewMode = useViewModeStore((s) => s.setViewMode)

  if (branchCount <= 1) {
    return null
  }

  const handleViewTree = () => {
    setViewMode('tree')
  }

  if (compact) {
    return (
      <Flex align="center" gap="xs" className="text-xs text-chatbox-tint-secondary">
        <ScalableIcon icon={IconGitBranch} size={14} />
        <Text size="xs">
          {currentBranchIndex + 1}/{branchCount}
        </Text>
        {onSwitchBranch && (
          <Flex gap={4}>
            <button
              className="px-1 py-0.5 rounded hover:bg-chatbox-background-secondary disabled:opacity-50"
              onClick={() => onSwitchBranch('prev')}
              disabled={currentBranchIndex === 0}
            >
              ←
            </button>
            <button
              className="px-1 py-0.5 rounded hover:bg-chatbox-background-secondary disabled:opacity-50"
              onClick={() => onSwitchBranch('next')}
              disabled={currentBranchIndex === branchCount - 1}
            >
              →
            </button>
          </Flex>
        )}
      </Flex>
    )
  }

  return (
    <Alert
      variant="light"
      color="blue"
      icon={<ScalableIcon icon={IconGitBranch} size={20} />}
      className="my-2"
    >
      <Flex align="center" justify="space-between" wrap="wrap" gap="sm">
        <Text size="sm">
          {t('This message has {{count}} response branches. Current: {{current}}/{{total}}', {
            count: branchCount,
            current: currentBranchIndex + 1,
            total: branchCount,
          })}
        </Text>
        <Flex gap="xs">
          {onSwitchBranch && (
            <Flex gap={4}>
              <Button
                size="xs"
                variant="light"
                onClick={() => onSwitchBranch('prev')}
                disabled={currentBranchIndex === 0}
              >
                {t('Previous')}
              </Button>
              <Button
                size="xs"
                variant="light"
                onClick={() => onSwitchBranch('next')}
                disabled={currentBranchIndex === branchCount - 1}
              >
                {t('Next')}
              </Button>
            </Flex>
          )}
          <Button
            size="xs"
            variant="filled"
            leftSection={<ScalableIcon icon={IconBinaryTree} size={14} />}
            onClick={handleViewTree}
          >
            {t('View in Tree')}
          </Button>
        </Flex>
      </Flex>
    </Alert>
  )
}

/**
 * 多分支提示横幅
 * 在列表视图顶部显示，提醒用户存在多个分支
 */
export function MultiBranchBanner({ hasBranches }: { hasBranches: boolean }) {
  const { t } = useTranslation()
  const setViewMode = useViewModeStore((s) => s.setViewMode)

  if (!hasBranches) {
    return null
  }

  return (
    <Alert
      variant="light"
      color="blue"
      icon={<ScalableIcon icon={IconGitBranch} size={18} />}
      className="mx-4 mt-2"
      withCloseButton
    >
      <Flex align="center" justify="space-between" gap="sm">
        <Text size="sm">
          {t('This conversation has multiple response branches. Switch to tree view to see all branches.')}
        </Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<ScalableIcon icon={IconBinaryTree} size={14} />}
          onClick={() => setViewMode('tree')}
        >
          {t('View Tree')}
        </Button>
      </Flex>
    </Alert>
  )
}

export default MultiBranchIndicator
