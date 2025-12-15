/**
 * 文本选中引用组件
 * 在消息详情抽屉中选中文字后显示浮窗"引用"按钮
 */

import { useCallback, useEffect, useState, useRef, type RefObject } from 'react'
import { Button, Paper, Portal } from '@mantine/core'
import { IconQuote } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

export interface TextSelectionQuoteProps {
  /** 监听文本选择的容器 ref */
  containerRef: RefObject<HTMLDivElement>
  /** 引用回调，传入选中的文本 */
  onQuote: (selectedText: string) => void
}

export function TextSelectionQuote({ containerRef, onQuote }: TextSelectionQuoteProps) {
  const { t } = useTranslation()
  const [selectedText, setSelectedText] = useState('')
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const buttonRef = useRef<HTMLDivElement>(null)

  // 处理文本选择
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      setSelectedText('')
      setPosition(null)
      return
    }

    const text = selection.toString().trim()
    if (!text) {
      setSelectedText('')
      setPosition(null)
      return
    }

    // 检查选择是否在容器内
    const container = containerRef.current
    if (!container) return

    const range = selection.getRangeAt(0)
    const commonAncestor = range.commonAncestorContainer
    
    // 检查选择的公共祖先是否在容器内
    if (!container.contains(commonAncestor)) {
      setSelectedText('')
      setPosition(null)
      return
    }

    // 获取选择区域的位置
    const rect = range.getBoundingClientRect()
    
    // 计算按钮位置（在选择区域上方居中）
    const x = rect.left + rect.width / 2
    const y = rect.top - 10

    setSelectedText(text)
    setPosition({ x, y })
  }, [containerRef])

  // 处理引用点击
  const handleQuoteClick = useCallback(() => {
    if (selectedText) {
      onQuote(selectedText)
      // 清除选择
      window.getSelection()?.removeAllRanges()
      setSelectedText('')
      setPosition(null)
    }
  }, [selectedText, onQuote])

  // 监听选择变化
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [handleSelectionChange])

  // 点击外部时隐藏按钮
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        // 延迟检查，让 selectionchange 先触发
        setTimeout(() => {
          const selection = window.getSelection()
          if (!selection || selection.isCollapsed) {
            setSelectedText('')
            setPosition(null)
          }
        }, 100)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  if (!selectedText || !position) return null

  return (
    <Portal>
      <div
        ref={buttonRef}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -100%)',
          zIndex: 9999,
        }}
      >
        <Paper
          shadow="md"
          radius="md"
          p={0}
          className="overflow-hidden"
        >
          <Button
            size="xs"
            variant="filled"
            color="blue"
            leftSection={<IconQuote size={14} />}
            onClick={handleQuoteClick}
          >
            {t('Quote')}
          </Button>
        </Paper>
      </div>
    </Portal>
  )
}

export default TextSelectionQuote
