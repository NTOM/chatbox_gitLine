/**
 * 视图模式切换按钮
 */

import { memo } from 'react'
import { SegmentedControl, Tooltip } from '@mantine/core'
import { IconList, IconBinaryTree2 } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useViewModeStore, type ViewMode } from '@/stores/viewModeStore'

export interface ViewModeSwitchProps {
  className?: string
}

function ViewModeSwitchComponent({ className }: ViewModeSwitchProps) {
  const { t } = useTranslation()
  const viewMode = useViewModeStore((s) => s.viewMode)
  const setViewMode = useViewModeStore((s) => s.setViewMode)

  return (
    <SegmentedControl
      className={`controls ${className || ''}`}
      size="xs"
      value={viewMode}
      onChange={(value) => setViewMode(value as ViewMode)}
      data={[
        {
          value: 'list',
          label: (
            <Tooltip label={t('List View')} withArrow>
              <div className="flex items-center gap-1 px-1">
                <IconList size={16} />
                <span className="hidden sm:inline">{t('List')}</span>
              </div>
            </Tooltip>
          ),
        },
        {
          value: 'tree',
          label: (
            <Tooltip label={t('Tree View')} withArrow>
              <div className="flex items-center gap-1 px-1">
                <IconBinaryTree2 size={16} />
                <span className="hidden sm:inline">{t('Tree')}</span>
              </div>
            </Tooltip>
          ),
        },
      ]}
    />
  )
}

export const ViewModeSwitch = memo(ViewModeSwitchComponent)
export default ViewModeSwitch
