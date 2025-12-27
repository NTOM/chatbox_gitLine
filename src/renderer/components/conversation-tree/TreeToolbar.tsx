/**
 * 树形图工具栏组件
 * 提供模式切换、聚焦、删除、整理等功能
 * 位于输入框上方，与输入框工具栏风格保持一致
 */

import { memo } from 'react'
import { ActionIcon, Flex, Tooltip } from '@mantine/core'
import { 
  IconPointer, 
  IconBoxMultiple, 
  IconFocus2, 
  IconTrash, 
  IconLayoutDistributeVertical,
  IconArrowBackUp,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/ScalableIcon'

// ============ 类型定义 ============

export type InteractionMode = 'click' | 'select'

export interface TreeToolbarProps {
  /** 当前交互模式 */
  mode: InteractionMode
  /** 模式变更回调 */
  onModeChange: (mode: InteractionMode) => void
  /** 选中的节点数量 */
  selectedCount: number
  /** 聚焦到选中节点 */
  onFocus: () => void
  /** 删除选中节点 */
  onDelete: () => void
  /** 自动整理布局 */
  onAutoLayout: () => void
  /** 撤销删除 */
  onUndo: () => void
  /** 是否有选中节点可聚焦 */
  canFocus: boolean
  /** 是否有选中节点可删除 */
  canDelete: boolean
  /** 是否可以撤销 */
  canUndo: boolean
  /** 额外的 className */
  className?: string
}

// ============ 组件 ============

function TreeToolbarComponent({
  mode,
  onModeChange,
  selectedCount,
  onFocus,
  onDelete,
  onAutoLayout,
  onUndo,
  canFocus,
  canDelete,
  canUndo,
  className,
}: TreeToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className={`flex justify-center py-1.5 ${className || ''}`}>
      <Flex gap="md" align="center">
        {/* 点击模式 */}
        <Tooltip label={t('Click mode: Click to select single node')} withArrow position="top">
          <ActionIcon
            size={24}
            variant="subtle"
            color={mode === 'click' ? 'chatbox-brand' : 'chatbox-secondary'}
            onClick={() => onModeChange('click')}
          >
            <ScalableIcon icon={IconPointer} size={22} strokeWidth={1.8} />
          </ActionIcon>
        </Tooltip>

        {/* 框选模式 */}
        <Tooltip 
          label={
            <div className="text-center">
              <div>{t('Select mode: Drag to fully enclose nodes')}</div>
              <div className="text-xs opacity-70 mt-0.5">{t('Ctrl/Shift+click for multi-select')}</div>
              {selectedCount > 0 && (
                <div className="text-xs opacity-70 mt-0.5">{selectedCount} {t('selected')}</div>
              )}
            </div>
          } 
          withArrow 
          position="top"
        >
          <ActionIcon
            size={24}
            variant="subtle"
            color={mode === 'select' ? 'chatbox-brand' : 'chatbox-secondary'}
            onClick={() => onModeChange('select')}
          >
            <ScalableIcon icon={IconBoxMultiple} size={22} strokeWidth={1.8} />
          </ActionIcon>
        </Tooltip>

        {/* 聚焦按钮 */}
        <Tooltip label={t('Focus on selected node')} withArrow position="top">
          <ActionIcon
            size={24}
            variant="subtle"
            color="chatbox-secondary"
            onClick={onFocus}
            disabled={!canFocus}
          >
            <ScalableIcon icon={IconFocus2} size={22} strokeWidth={1.8} />
          </ActionIcon>
        </Tooltip>

        {/* 删除按钮 */}
        <Tooltip label={t('Delete selected nodes')} withArrow position="top">
          <ActionIcon
            size={24}
            variant="subtle"
            color="chatbox-secondary"
            onClick={onDelete}
            disabled={!canDelete}
          >
            <ScalableIcon icon={IconTrash} size={22} strokeWidth={1.8} />
          </ActionIcon>
        </Tooltip>

        {/* 整理布局按钮 */}
        <Tooltip label={t('Auto arrange layout')} withArrow position="top">
          <ActionIcon
            size={24}
            variant="subtle"
            color="chatbox-secondary"
            onClick={onAutoLayout}
          >
            <ScalableIcon icon={IconLayoutDistributeVertical} size={22} strokeWidth={1.8} />
          </ActionIcon>
        </Tooltip>

        {/* 撤销删除按钮 */}
        <Tooltip label={t('Undo delete')} withArrow position="top">
          <ActionIcon
            size={24}
            variant="subtle"
            color="chatbox-secondary"
            onClick={onUndo}
            disabled={!canUndo}
          >
            <ScalableIcon icon={IconArrowBackUp} size={22} strokeWidth={1.8} />
          </ActionIcon>
        </Tooltip>
      </Flex>
    </div>
  )
}

export const TreeToolbar = memo(TreeToolbarComponent)
export default TreeToolbar
