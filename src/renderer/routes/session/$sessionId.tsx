import { ErrorBoundary } from '@/components/ErrorBoundary'
import Header from '@/components/Header'
import InputBox from '@/components/InputBox/InputBox'
import MessageList, { type MessageListRef } from '@/components/MessageList'
import ThreadHistoryDrawer from '@/components/ThreadHistoryDrawer'
import { ConversationTreeView } from '@/components/conversation-tree'
import TreeToolbar from '@/components/conversation-tree/TreeToolbar'
import { updateSession as updateSessionStore, useSession } from '@/stores/chatStore'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import * as scrollActions from '@/stores/scrollActions'
import { modifyMessage, removeCurrentThread, startNewThread, submitNewUserMessage } from '@/stores/sessionActions'
import { getAllMessageList } from '@/stores/sessionHelpers'
import { useViewModeStore } from '@/stores/viewModeStore'
import NiceModal from '@ebay/nice-modal-react'
import { Button } from '@mantine/core'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Message, ModelProvider } from 'src/shared/types'
import { useStore } from 'zustand'

export const Route = createFileRoute('/session/$sessionId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const { sessionId: currentSessionId } = Route.useParams()
  const navigate = useNavigate()
  const { session: currentSession, isFetching } = useSession(currentSessionId)
  const setLastUsedChatModel = useStore(lastUsedModelStore, (state) => state.setChatModel)
  const setLastUsedPictureModel = useStore(lastUsedModelStore, (state) => state.setPictureModel)
  const viewMode = useViewModeStore((s) => s.viewMode)
  
  // 树形图工具栏相关状态
  const interactionMode = useViewModeStore((s) => s.interactionMode)
  const setInteractionMode = useViewModeStore((s) => s.setInteractionMode)
  const selectedNodeId = useViewModeStore((s) => s.selectedNodeId)
  const selectedNodeIds = useViewModeStore((s) => s.selectedNodeIds)
  const treeUndoState = useViewModeStore((s) => s.treeUndoState)

  const currentMessageList = useMemo(() => (currentSession ? getAllMessageList(currentSession) : []), [currentSession])
  const lastGeneratingMessage = useMemo(
    () => currentMessageList.find((m: Message) => m.generating),
    [currentMessageList]
  )

  const messageListRef = useRef<MessageListRef>(null)

  const goHome = useCallback(() => {
    navigate({ to: '/', replace: true })
  }, [navigate])

  useEffect(() => {
    setTimeout(() => {
      scrollActions.scrollToBottom('auto') // 每次启动时自动滚动到底部
    }, 200)
  }, [])

  // currentSession变化时（包括session settings变化），存下当前的settings作为新Session的默认值
  useEffect(() => {
    if (currentSession) {
      if (currentSession.type === 'chat' && currentSession.settings) {
        const { provider, modelId } = currentSession.settings
        if (provider && modelId) {
          setLastUsedChatModel(provider, modelId)
        }
      }
      if (currentSession.type === 'picture' && currentSession.settings) {
        const { provider, modelId } = currentSession.settings
        if (provider && modelId) {
          setLastUsedPictureModel(provider, modelId)
        }
      }
    }
  }, [currentSession?.settings, currentSession?.type, currentSession, setLastUsedChatModel, setLastUsedPictureModel])

  const onSelectModel = useCallback(
    (provider: ModelProvider, modelId: string) => {
      if (!currentSession) {
        return
      }
      void updateSessionStore(currentSession.id, {
        settings: {
          ...(currentSession.settings || {}),
          provider,
          modelId,
        },
      })
    },
    [currentSession]
  )

  const onStartNewThread = useCallback(() => {
    if (!currentSession) {
      return false
    }
    void startNewThread(currentSession.id)
    return true
  }, [currentSession])

  const onRollbackThread = useCallback(() => {
    if (!currentSession) {
      return false
    }
    void removeCurrentThread(currentSession.id)
    return true
  }, [currentSession])

  const onSubmit = useCallback(
    async ({
      constructedMessage,
      needGenerating = true,
      multiModels,
    }: {
      constructedMessage: Message
      needGenerating?: boolean
      multiModels?: Array<{ provider: string; modelId: string }>
    }) => {
      if (!currentSession) {
        return
      }
      messageListRef.current?.scrollToBottom('instant')
      await submitNewUserMessage(currentSession.id, {
        newUserMsg: constructedMessage,
        needGenerating,
        multiModels,
      })
    },
    [currentSession]
  )

  const onClickSessionSettings = useCallback(() => {
    if (!currentSession) {
      return false
    }
    NiceModal.show('session-settings', {
      session: currentSession,
    })
    return true
  }, [currentSession])

  const onStopGenerating = useCallback(() => {
    if (!currentSession) {
      return false
    }
    if (lastGeneratingMessage?.generating) {
      lastGeneratingMessage?.cancel?.()
      void modifyMessage(currentSession.id, { ...lastGeneratingMessage, generating: false }, true)
    }
    return true
  }, [currentSession, lastGeneratingMessage])

  const model = useMemo(() => {
    if (!currentSession?.settings?.modelId || !currentSession?.settings?.provider) {
      return undefined
    }
    return {
      provider: currentSession.settings.provider,
      modelId: currentSession.settings.modelId,
    }
  }, [currentSession?.settings?.provider, currentSession?.settings?.modelId])

  return currentSession ? (
    <div className="flex flex-col h-full">
      <Header session={currentSession} />

      {/* 根据视图模式显示不同的视图 */}
      {viewMode === 'list' ? (
        <MessageList ref={messageListRef} key={`message-list${currentSessionId}`} currentSession={currentSession} />
      ) : (
        <ConversationTreeView
          key={`tree-view${currentSessionId}`}
          session={currentSession}
          className="flex-1 min-h-0"
        />
      )}

      {/* 树形图工具栏 - 始终紧贴在输入框上方 */}
      {viewMode === 'tree' && (
        <TreeToolbar
          mode={interactionMode}
          onModeChange={setInteractionMode}
          selectedCount={interactionMode === 'click' ? (selectedNodeId ? 1 : 0) : selectedNodeIds.length}
          onFocus={() => window.dispatchEvent(new CustomEvent('tree-toolbar-focus'))}
          onDelete={() => window.dispatchEvent(new CustomEvent('tree-toolbar-delete'))}
          onAutoLayout={() => window.dispatchEvent(new CustomEvent('tree-toolbar-auto-layout'))}
          onUndo={() => window.dispatchEvent(new CustomEvent('tree-toolbar-undo'))}
          canFocus={interactionMode === 'click' ? !!selectedNodeId : selectedNodeIds.length > 0}
          canDelete={interactionMode === 'click' ? !!selectedNodeId : selectedNodeIds.length > 0}
          canUndo={treeUndoState !== null && treeUndoState.sessionId === currentSession.id}
        />
      )}

      {/* <ScrollButtons /> */}
      <ErrorBoundary name="session-inputbox">
        <InputBox
          key={`input-box${currentSession.id}`}
          sessionId={currentSession.id}
          sessionType={currentSession.type}
          model={model}
          onStartNewThread={onStartNewThread}
          onRollbackThread={onRollbackThread}
          onSelectModel={onSelectModel}
          onClickSessionSettings={onClickSessionSettings}
          generating={!!lastGeneratingMessage}
          onSubmit={onSubmit}
          onStopGenerating={onStopGenerating}
        />
      </ErrorBoundary>
      <ThreadHistoryDrawer session={currentSession} />
    </div>
  ) : (
    !isFetching && (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh]">
        <div className="text-2xl font-semibold text-gray-700 mb-4">{t('Conversation not found')}</div>
        <Button variant="outline" onClick={goHome}>
          {t('Back to HomePage')}
        </Button>
      </div>
    )
  )
}
