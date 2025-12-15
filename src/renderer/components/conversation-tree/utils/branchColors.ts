/**
 * 分支颜色工具
 * 提供统一的分支颜色方案
 */

// 分支颜色调色板 - 用于区分不同分支
export const BRANCH_COLORS = [
  { bg: '#fef3c7', border: '#f59e0b', text: '#b45309' }, // amber
  { bg: '#ede9fe', border: '#8b5cf6', text: '#6d28d9' }, // violet
  { bg: '#fce7f3', border: '#ec4899', text: '#be185d' }, // pink
  { bg: '#cffafe', border: '#06b6d4', text: '#0e7490' }, // cyan
  { bg: '#ffedd5', border: '#f97316', text: '#c2410c' }, // orange
  { bg: '#f3e8ff', border: '#a855f7', text: '#7e22ce' }, // purple
  { bg: '#ccfbf1', border: '#14b8a6', text: '#0f766e' }, // teal
  { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c' }, // red
] as const

export type BranchColor = (typeof BRANCH_COLORS)[number]

/**
 * 根据分支索引获取颜色
 */
export function getBranchColor(branchIndex: number): BranchColor {
  return BRANCH_COLORS[branchIndex % BRANCH_COLORS.length]
}

/**
 * 获取分支边框颜色（用于边组件）
 */
export function getBranchBorderColor(branchIndex: number): string {
  return BRANCH_COLORS[branchIndex % BRANCH_COLORS.length].border
}

/**
 * 获取分支背景颜色
 */
export function getBranchBgColor(branchIndex: number): string {
  return BRANCH_COLORS[branchIndex % BRANCH_COLORS.length].bg
}

/**
 * 获取分支文字颜色
 */
export function getBranchTextColor(branchIndex: number): string {
  return BRANCH_COLORS[branchIndex % BRANCH_COLORS.length].text
}
