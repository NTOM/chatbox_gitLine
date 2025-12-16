/**
 * 视图模式状态管理
 * 用于在列表视图和节点视图之间切换
 */

import { createStore, useStore } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './safeStorage'

export type ViewMode = 'list' | 'tree'

/** 节点位置类型 */
export type NodePositions = Record<string, { x: number; y: number }>

/** 按会话ID存储的节点位置 */
export type SessionNodePositions = Record<string, NodePositions>

interface ViewModeState {
  /** 当前视图模式 */
  viewMode: ViewMode
  /** 节点视图中选中的节点ID */
  selectedNodeId: string | null
  /** 节点视图的缩放级别 */
  treeZoom: number
  /** 节点视图的画布位置 */
  treePosition: { x: number; y: number }
  /** 按会话ID存储的节点位置 */
  nodePositions: SessionNodePositions
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
  /** 更新单个节点位置 */
  updateNodePosition: (sessionId: string, nodeId: string, position: { x: number; y: number }) => void
  /** 批量更新节点位置 */
  updateNodePositions: (sessionId: string, positions: NodePositions) => void
  /** 清除会话的节点位置 */
  clearNodePositions: (sessionId: string) => void
}

const initialState: ViewModeState = {
  viewMode: 'list',
  selectedNodeId: null,
  treeZoom: 1,
  treePosition: { x: 0, y: 0 },
  nodePositions: {},
}

export const viewModeStore = createStore<ViewModeState & ViewModeActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setViewMode: (mode) => set({ viewMode: mode }),

      toggleViewMode: () => {
        const current = get().viewMode
        set({ viewMode: current === 'list' ? 'tree' : 'list' })
      },

      setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),

      setTreeZoom: (zoom) => set({ treeZoom: zoom }),

      setTreePosition: (position) => set({ treePosition: position }),

      resetTreeView: () => set({
        selectedNodeId: null,
        treeZoom: 1,
        treePosition: { x: 0, y: 0 },
      }),

      updateNodePosition: (sessionId, nodeId, position) => {
        const { nodePositions } = get()
        set({
          nodePositions: {
            ...nodePositions,
            [sessionId]: {
              ...nodePositions[sessionId],
              [nodeId]: position,
            },
          },
        })
      },

      updateNodePositions: (sessionId, positions) => {
        const { nodePositions } = get()
        set({
          nodePositions: {
            ...nodePositions,
            [sessionId]: {
              ...nodePositions[sessionId],
              ...positions,
            },
          },
        })
      },

      clearNodePositions: (sessionId) => {
        const { nodePositions } = get()
        const { [sessionId]: _, ...rest } = nodePositions
        set({ nodePositions: rest })
      },
    }),
    {
      name: 'view-mode-store',
      version: 2,
      partialize: (state) => ({
        viewMode: state.viewMode,
        nodePositions: state.nodePositions,
      }),
      storage: safeStorage,
      // 版本迁移：从 v1 升级到 v2
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<ViewModeState>
        if (version < 2) {
          // v1 没有 nodePositions，添加默认值
          return {
            ...state,
            nodePositions: state.nodePositions || {},
          }
        }
        return state as ViewModeState
      },
    }
  )
)

export function useViewModeStore<U>(selector: (state: ViewModeState & ViewModeActions) => U) {
  return useStore(viewModeStore, selector)
}
