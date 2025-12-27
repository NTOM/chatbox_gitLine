/**
 * 多模型选择器组件
 * 支持选择多个模型进行同时对话
 */

import { ActionIcon, Badge, Button, Checkbox, Collapse, Flex, Popover, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconCheck, IconChevronDown, IconChevronRight, IconSearch, IconX } from '@tabler/icons-react'
import { useAtom } from 'jotai'
import { forwardRef, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProviderModelInfo } from 'src/shared/types'
import { useProviders } from '@/hooks/useProviders'
import { collapsedProvidersAtom } from '@/stores/atoms/uiAtoms'
import { useMultiModelStore, type ModelInfo } from '@/stores/multiModelStore'
import { ScalableIcon } from '../ScalableIcon'
import ProviderImageIcon from '../icons/ProviderImageIcon'

interface MultiModelSelectorProps {
  children: React.ReactNode
  /** 当前单选模式下选中的模型 */
  currentModel?: ModelInfo
  /** 选择模型回调（单选模式） */
  onSelect?: (provider: string, modelId: string) => void
}

export const MultiModelSelector = forwardRef<HTMLDivElement, MultiModelSelectorProps>(function MultiModelSelector({ children, currentModel, onSelect }, ref) {
  const { t } = useTranslation()
  const { providers } = useProviders()
  const [opened, setOpened] = useState(false)
  const [search, setSearch] = useState('')
  const [collapsedProviders, setCollapsedProviders] = useAtom(collapsedProvidersAtom)

  // 多模型状态
  const multiModelEnabled = useMultiModelStore((s) => s.multiModelEnabled)
  const selectedModels = useMultiModelStore((s) => s.selectedModels)
  const toggleModel = useMultiModelStore((s) => s.toggleModel)
  const isModelSelected = useMultiModelStore((s) => s.isModelSelected)
  const maxModels = useMultiModelStore((s) => s.maxModels)

  // 过滤 providers
  const filteredProviders = useMemo(() => {
    return providers
      .map((provider) => {
        const models = (provider.models || provider.defaultSettings?.models || []).filter(
          (model) => {
            if (!search) return true
            const searchLower = search.toLowerCase()
            return (
              model.modelId.toLowerCase().includes(searchLower) ||
              model.nickname?.toLowerCase().includes(searchLower) ||
              provider.name.toLowerCase().includes(searchLower)
            )
          }
        )
        return { ...provider, models }
      })
      .filter((provider) => provider.models && provider.models.length > 0)
  }, [providers, search])

  const toggleProviderCollapse = (providerId: string) => {
    setCollapsedProviders((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }))
  }

  const handleModelClick = useCallback(
    (provider: string, modelId: string) => {
      if (multiModelEnabled) {
        toggleModel({ provider, modelId })
      } else {
        onSelect?.(provider, modelId)
        setOpened(false)
      }
    },
    [multiModelEnabled, toggleModel, onSelect]
  )

  const getModelDisplayName = (model: ProviderModelInfo) => {
    return model.nickname || model.modelId
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={380}
      position="top-end"
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <div ref={ref} onClick={() => setOpened((o) => !o)} style={{ cursor: 'pointer' }}>
          {children}
        </div>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <Stack gap={0}>
          {/* 搜索框 */}
          <Flex align="center" px="sm" py="xs" style={{ borderBottom: '1px solid var(--chatbox-border-primary)' }}>
            <ScalableIcon icon={IconSearch} size={16} className="text-chatbox-tint-gray" />
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              placeholder={t('Search models') as string}
              variant="unstyled"
              className="flex-1 ml-xs"
              styles={{
                input: {
                  padding: 0,
                  height: 'auto',
                  minHeight: 'auto',
                  fontSize: 'var(--mantine-font-size-sm)',
                },
              }}
            />
            {multiModelEnabled && (
              <Badge size="sm" variant="light" color="blue">
                {selectedModels.length}/{maxModels}
              </Badge>
            )}
          </Flex>

          {/* 模型列表 */}
          <div style={{ maxHeight: '50vh', overflowY: 'auto' }} className="px-xs pb-xs">
            {filteredProviders.map((provider) => {
              const isCollapsed = collapsedProviders[provider.id] || false

              return (
                <div key={provider.id}>
                  {/* Provider 头部 */}
                  <Flex
                    align="center"
                    py="xs"
                    px="xs"
                    className="cursor-pointer hover:bg-chatbox-background-secondary rounded -mx-xs"
                    onClick={() => toggleProviderCollapse(provider.id)}
                  >
                    <ScalableIcon
                      icon={isCollapsed ? IconChevronRight : IconChevronDown}
                      size={14}
                      className="text-chatbox-tint-gray mr-xs"
                    />
                    <ProviderImageIcon size={18} provider={provider.id} />
                    <Text size="sm" fw={500} ml="xs" className="flex-1">
                      {provider.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {provider.models?.length}
                    </Text>
                  </Flex>

                  {/* 模型列表 */}
                  <Collapse in={!isCollapsed}>
                    <div className="mb-xs">
                      {provider.models?.map((model) => {
                        const isSelected = multiModelEnabled
                          ? isModelSelected(provider.id, model.modelId)
                          : currentModel?.provider === provider.id && currentModel?.modelId === model.modelId

                        return (
                          <Flex
                            key={`${provider.id}/${model.modelId}`}
                            align="center"
                            py="xs"
                            px="sm"
                            className={`cursor-pointer rounded ml-md ${
                              isSelected
                                ? 'bg-chatbox-brand/10'
                                : 'hover:bg-chatbox-background-secondary'
                            }`}
                            onClick={() => handleModelClick(provider.id, model.modelId)}
                          >
                            {multiModelEnabled && (
                              <Checkbox
                                checked={isSelected}
                                onChange={() => {}}
                                size="xs"
                                mr="xs"
                                styles={{ input: { cursor: 'pointer' } }}
                              />
                            )}
                            <Text size="sm" className="flex-1 truncate">
                              {getModelDisplayName(model)}
                            </Text>
                            {!multiModelEnabled && isSelected && (
                              <ScalableIcon icon={IconCheck} size={16} className="text-chatbox-brand" />
                            )}
                          </Flex>
                        )
                      })}
                    </div>
                  </Collapse>
                </div>
              )
            })}

            {filteredProviders.length === 0 && (
              <Text size="sm" c="dimmed" ta="center" py="md">
                {t('No eligible models available')}
              </Text>
            )}
          </div>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
})

/** 已选模型展示组件 */
export function SelectedModelsDisplay() {
  const { t } = useTranslation()
  const { providers } = useProviders()
  const selectedModels = useMultiModelStore((s) => s.selectedModels)
  const removeModel = useMultiModelStore((s) => s.removeModel)

  const getModelInfo = (model: ModelInfo) => {
    const provider = providers.find((p) => p.id === model.provider)
    const modelInfo = (provider?.models || provider?.defaultSettings?.models)?.find(
      (m) => m.modelId === model.modelId
    )
    return {
      providerName: provider?.name || model.provider,
      modelName: modelInfo?.nickname || model.modelId,
    }
  }

  if (selectedModels.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        {t('No models selected')}
      </Text>
    )
  }

  return (
    <Flex gap="xs" wrap="wrap">
      {selectedModels.map((model) => {
        const info = getModelInfo(model)
        return (
          <Badge
            key={`${model.provider}/${model.modelId}`}
            size="sm"
            variant="light"
            rightSection={
              <ActionIcon
                size="xs"
                variant="transparent"
                onClick={(e) => {
                  e.stopPropagation()
                  removeModel(model.provider, model.modelId)
                }}
              >
                <IconX size={12} />
              </ActionIcon>
            }
          >
            <Flex align="center" gap={4}>
              <ProviderImageIcon size={14} provider={model.provider} />
              <span>{info.modelName}</span>
            </Flex>
          </Badge>
        )
      })}
    </Flex>
  )
}

export default MultiModelSelector
