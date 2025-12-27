/**
 * 多模型模式切换按钮
 */

import { ActionIcon, Tooltip } from '@mantine/core'
import { IconLayersLinked, IconLayersOff } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useMultiModelStore } from '@/stores/multiModelStore'
import { ScalableIcon } from './ScalableIcon'

interface MultiModelToggleProps {
  size?: number
  iconSize?: number
}

export function MultiModelToggle({ size = 24, iconSize = 20 }: MultiModelToggleProps) {
  const { t } = useTranslation()
  const multiModelEnabled = useMultiModelStore((s) => s.multiModelEnabled)
  const toggleMultiModelMode = useMultiModelStore((s) => s.toggleMultiModelMode)
  const selectedModels = useMultiModelStore((s) => s.selectedModels)

  return (
    <Tooltip
      label={
        multiModelEnabled
          ? t('Multi-model mode enabled ({{count}} selected)', { count: selectedModels.length })
          : t('Enable multi-model mode')
      }
      withArrow
      position="top"
    >
      <ActionIcon
        size={size}
        variant={multiModelEnabled ? 'light' : 'subtle'}
        color={multiModelEnabled ? 'blue' : 'chatbox-secondary'}
        onClick={toggleMultiModelMode}
      >
        <ScalableIcon
          icon={multiModelEnabled ? IconLayersLinked : IconLayersOff}
          size={iconSize}
          strokeWidth={1.8}
        />
      </ActionIcon>
    </Tooltip>
  )
}

export default MultiModelToggle
