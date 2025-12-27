/**
 * 多模型对话状态管理
 * 用于管理多模型选择模式和选中的模型列表
 */

import { createStore, useStore } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './safeStorage'

/** 模型信息 */
export interface ModelInfo {
  provider: string
  modelId: string
}

interface MultiModelState {
  /** 是否启用多模型模式 */
  multiModelEnabled: boolean
  /** 选中的模型列表 */
  selectedModels: ModelInfo[]
  /** 最大可选模型数量 */
  maxModels: number
}

interface MultiModelActions {
  /** 切换多模型模式 */
  toggleMultiModelMode: () => void
  /** 设置多模型模式 */
  setMultiModelEnabled: (enabled: boolean) => void
  /** 添加模型 */
  addModel: (model: ModelInfo) => void
  /** 移除模型 */
  removeModel: (provider: string, modelId: string) => void
  /** 切换模型选中状态 */
  toggleModel: (model: ModelInfo) => void
  /** 清空选中的模型 */
  clearModels: () => void
  /** 设置选中的模型列表 */
  setSelectedModels: (models: ModelInfo[]) => void
  /** 检查模型是否已选中 */
  isModelSelected: (provider: string, modelId: string) => boolean
}

const initialState: MultiModelState = {
  multiModelEnabled: false,
  selectedModels: [],
  maxModels: 5,
}

export const multiModelStore = createStore<MultiModelState & MultiModelActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      toggleMultiModelMode: () => {
        const current = get().multiModelEnabled
        set({ 
          multiModelEnabled: !current,
          // 关闭多模型模式时清空选中的模型
          selectedModels: !current ? get().selectedModels : [],
        })
      },

      setMultiModelEnabled: (enabled) => {
        set({ 
          multiModelEnabled: enabled,
          selectedModels: enabled ? get().selectedModels : [],
        })
      },

      addModel: (model) => {
        const { selectedModels, maxModels } = get()
        // 检查是否已存在
        const exists = selectedModels.some(
          (m) => m.provider === model.provider && m.modelId === model.modelId
        )
        if (exists || selectedModels.length >= maxModels) {
          return
        }
        set({ selectedModels: [...selectedModels, model] })
      },

      removeModel: (provider, modelId) => {
        const { selectedModels } = get()
        set({
          selectedModels: selectedModels.filter(
            (m) => !(m.provider === provider && m.modelId === modelId)
          ),
        })
      },

      toggleModel: (model) => {
        const { selectedModels, maxModels } = get()
        const exists = selectedModels.some(
          (m) => m.provider === model.provider && m.modelId === model.modelId
        )
        if (exists) {
          set({
            selectedModels: selectedModels.filter(
              (m) => !(m.provider === model.provider && m.modelId === model.modelId)
            ),
          })
        } else if (selectedModels.length < maxModels) {
          set({ selectedModels: [...selectedModels, model] })
        }
      },

      clearModels: () => set({ selectedModels: [] }),

      setSelectedModels: (models) => {
        const { maxModels } = get()
        set({ selectedModels: models.slice(0, maxModels) })
      },

      isModelSelected: (provider, modelId) => {
        const { selectedModels } = get()
        return selectedModels.some(
          (m) => m.provider === provider && m.modelId === modelId
        )
      },
    }),
    {
      name: 'multi-model-store',
      version: 1,
      partialize: (state) => ({
        multiModelEnabled: state.multiModelEnabled,
        selectedModels: state.selectedModels,
      }),
      storage: safeStorage,
    }
  )
)

export function useMultiModelStore<U>(selector: (state: MultiModelState & MultiModelActions) => U) {
  return useStore(multiModelStore, selector)
}
