/**
 * 视图模式状态管理
 * 用于在列表视图和节点视图之间切换
 */

import { createStore, useStore } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './safeStorage'

export type ViewMode = 'list' | 'tree'

interface ViewModeState {
  /** 当前视图模式 */
  viewMode: ViewMode
  /** 节点视图中选中的节点ID */
  selectedNodeId: string | null
  /** 节点视图的缩放级别 */
  treeZoom: number
  /** 节点视图的画布位置 */
  treePosition: { x: number; y: number }
}

interface ViewModeActions {
  /** 设置视图模式 */
  setViewMode: (mode: ViewMode) => void
  /** 切换视图模式 */
  toggleViewMode: () => void
  /** 设置选中的节点 */
  setSelectedNodeId: (nodeId: string | null) => void
  /** 设置树视图缩放 */
  setTreeZoom: (zoom: number) => void
  /** 设置树视图位置 */
  setTreePosition: (position: { x: number; y: number }) => void
  /** 重置树视图状态 */
  resetTreeView: () => void
}

const initialState: ViewModeState = {
  viewMode: 'list',
  selectedNodeId: null,
  treeZoom: 1,
  treePosition: { x: 0, y: 0 },
}

export const viewModeStore = createStore<ViewModeState & ViewModeActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setViewMode: (mode) => {
        set({ viewMode: mode })
      },

      toggleViewMode: () => {
        const current = get().viewMode
        set({ viewMode: current === 'list' ? 'tree' : 'list' })
      },

      setSelectedNodeId: (nodeId) => {
        set({ selectedNodeId: nodeId })
      },

      setTreeZoom: (zoom) => {
        set({ treeZoom: zoom })
      },

      setTreePosition: (position) => {
        set({ treePosition: position })
      },

      resetTreeView: () => {
        set({
          selectedNodeId: null,
          treeZoom: 1,
          treePosition: { x: 0, y: 0 },
        })
      },
    }),
    {
      name: 'view-mode-store',
      version: 1,
      partialize: (state) => ({
        viewMode: state.viewMode,
      }),
      storage: safeStorage,
    }
  )
)

export function useViewModeStore<U>(selector: (state: ViewModeState & ViewModeActions) => U) {
  return useStore(viewModeStore, selector)
}
