/**
 * This module contains all fundamental operations for chat sessions and messages.
 * It uses react-query for caching.
 * */

import { useQuery } from '@tanstack/react-query'
import compact from 'lodash/compact'
import isEmpty from 'lodash/isEmpty'
import { useMemo } from 'react'
import {
  type Message,
  type Session,
  type SessionMeta,
  type SessionSettings,
  SessionSettingsSchema,
  type Updater,
  type UpdaterFn,
} from 'src/shared/types'
import { v4 as uuidv4 } from 'uuid'
import storage, { StorageKey } from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import * as defaults from '../../shared/defaults'
import { migrateSession, sortSessions } from '../utils/session-utils'
import { lastUsedModelStore } from './lastUsedModelStore'
import queryClient from './queryClient'
import { getSessionMeta } from './sessionHelpers'
import { settingsStore, useSettingsStore } from './settingsStore'
import { UpdateQueue } from './updateQueue'

const QueryKeys = {
  ChatSessionsList: ['chat-sessions-list'],
  ChatSession: (id: string) => ['chat-session', id],
}

// MARK: session list operations

// list sessions meta
async function _listSessionsMeta(): Promise<SessionMeta[]> {
  console.debug('chatStore', 'listSessionsMeta')
  const sessionMetaList = await storage.getItem<SessionMeta[]>(StorageKey.ChatSessionsList, [])
  // session list showing order: reversed, pinned at top
  return sessionMetaList
}

const listSessionsMetaQueryOptions = {
  queryKey: QueryKeys.ChatSessionsList,
  queryFn: () => _listSessionsMeta().then(sortSessions),
  staleTime: Infinity,
}

export async function listSessionsMeta() {
  return await queryClient.fetchQuery(listSessionsMetaQueryOptions)
}

export function useSessionList() {
  const { data: sessionMetaList, refetch } = useQuery({ ...listSessionsMetaQueryOptions })
  return { sessionMetaList, refetch }
}

let sessionListUpdateQueue: UpdateQueue<SessionMeta[]> | null = null

export async function updateSessionList(updater: UpdaterFn<SessionMeta[]>) {
  if (!sessionListUpdateQueue) {
    sessionListUpdateQueue = new UpdateQueue<SessionMeta[]>(
      () => _listSessionsMeta(),
      async (sessions) => {
        await storage.setItemNow(StorageKey.ChatSessionsList, sessions)
      }
    )
  }
  console.debug('chatStore', 'updateSessionList', updater)
  const result = await sessionListUpdateQueue.set(updater)
  queryClient.setQueryData(QueryKeys.ChatSessionsList, sortSessions(result))
}

// MARK: session operations

// get session
async function _getSessionById(id: string): Promise<Session | null> {
  console.debug('chatStore', 'getSessionById', id)
  const session = await storage.getItem<Session | null>(StorageKeyGenerator.session(id), null)
  if (!session) {
    return null
  }
  return migrateSession(session)
}

const getSessionQueryOptions = (sessionId: string) => ({
  queryKey: QueryKeys.ChatSession(sessionId),
  queryFn: () => _getSessionById(sessionId),
  staleTime: Infinity,
})

export async function getSession(sessionId: string) {
  return await queryClient.fetchQuery(getSessionQueryOptions(sessionId))
}

export function useSession(sessionId: string | null) {
  const { data: session, ...rest } = useQuery({
    ...getSessionQueryOptions(sessionId!),
    enabled: !!sessionId,
  })
  return { session, ...rest }
}

function _setSessionCache(sessionId: string, updated: Session | null) {
  // 1. update session cache 2. session settings do not use cache now
  queryClient.setQueryData(QueryKeys.ChatSession(sessionId), updated)
}

// create session
export async function createSession(newSession: Omit<Session, 'id'>, previousId?: string) {
  console.debug('chatStore', 'createSession', newSession)
  const { chat: lastUsedChatModel, picture: lastUsedPictureModel } = lastUsedModelStore.getState()
  const session = {
    ...newSession,
    id: uuidv4(),
    settings: {
      ...(newSession.type === 'picture' ? lastUsedPictureModel : lastUsedChatModel),
      ...newSession.settings,
    },
  }
  await storage.setItemNow(StorageKeyGenerator.session(session.id), session)
  const sMeta = getSessionMeta(session)
  await updateSessionList((sessions) => {
    if (!sessions) {
      throw new Error('Session list not found')
    }
    if (previousId) {
      let previouseSessionIndex = sessions.findIndex((s) => s.id === previousId)
      if (previouseSessionIndex < 0) {
        previouseSessionIndex = sessions.length - 1
      }
      return [...sessions.slice(0, previouseSessionIndex + 1), sMeta, ...sessions.slice(previouseSessionIndex + 1)]
    }
    return [...sessions, sMeta]
  })
  return session
}

const sessionUpdateQueues: Record<string, UpdateQueue<Session>> = {}

export async function updateSessionWithMessages(sessionId: string, updater: Updater<Session>) {
  console.debug('chatStore', 'updateSession', sessionId, updater)
  if (!sessionUpdateQueues[sessionId]) {
    // do not use await here to avoid data race
    sessionUpdateQueues[sessionId] = new UpdateQueue<Session>(
      () => getSession(sessionId),
      async (session) => {
        if (session) {
          console.debug('chatStore', 'persist session', sessionId)
          await storage.setItemNow(StorageKeyGenerator.session(sessionId), session)
        }
      }
    )
  }
  let needUpdateSessionList = true
  const updated = await sessionUpdateQueues[sessionId].set((prev) => {
    if (!prev) {
      throw new Error(`Session ${sessionId} not found`)
    }
    if (typeof updater === 'function') {
      return updater(prev)
    } else {
      if (isEmpty(getSessionMeta(updater as SessionMeta))) {
        needUpdateSessionList = false
      }
      return { ...prev, ...updater }
    }
  })
  if (needUpdateSessionList) {
    await updateSessionList((sessions) => {
      if (!sessions) {
        throw new Error('Session list not found')
      }
      return sessions.map((session) => (session.id === sessionId ? getSessionMeta(updated) : session))
    })
  }
  _setSessionCache(sessionId, updated)
  return updated
}

// 这里只能修改messages之外的字段
export async function updateSession(sessionId: string, updater: Updater<Omit<Session, 'messages'>>) {
  return await updateSessionWithMessages(sessionId, (session) => {
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    const updated = typeof updater === 'function' ? updater(session) : updater
    return {
      ...session,
      ...updated,
    }
  })
}

// only update session cache without touching storage, for performance sensitive usage
export async function updateSessionCache(sessionId: string, updater: Updater<Session>) {
  console.debug('chatStore', 'updateSessionCache', sessionId, updater)
  const session = await getSession(sessionId)
  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }
  queryClient.setQueryData(QueryKeys.ChatSession(sessionId), (old: Session | undefined | null) => {
    if (!old) {
      return old
    }
    if (typeof updater === 'function') {
      return updater(old)
    } else {
      return { ...old, ...updater }
    }
  })
}

export async function deleteSession(id: string) {
  console.debug('chatStore', 'deleteSession', id)
  await storage.removeItem(StorageKeyGenerator.session(id))
  _setSessionCache(id, null)
  await updateSessionList((sessions) => {
    if (!sessions) {
      throw new Error('Session list not found')
    }
    return sessions.filter((session) => session.id !== id)
  })
}

// MARK: session settings operations

function mergeDefaultSessionSettings(session: Session): SessionSettings {
  if (session.type === 'picture') {
    return SessionSettingsSchema.parse({
      ...defaults.pictureSessionSettings(),
      ...session.settings,
    })
  } else {
    return SessionSettingsSchema.parse({
      ...defaults.chatSessionSettings(),
      ...session.settings,
    })
  }
}
// session settings is copied from global settings when session is created, so no need to merge global settings here
export function useSessionSettings(sessionId: string | null) {
  const { session } = useSession(sessionId)
  const globalSettings = useSettingsStore((state) => state)

  const sessionSettings = useMemo(() => {
    if (!session) {
      return SessionSettingsSchema.parse(globalSettings)
    }
    return mergeDefaultSessionSettings(session)
  }, [session, globalSettings])

  return { sessionSettings }
}

export async function getSessionSettings(sessionId: string) {
  const session = await getSession(sessionId)
  if (!session) {
    const globalSettings = settingsStore.getState().getSettings()
    return SessionSettingsSchema.parse(globalSettings)
  }
  return mergeDefaultSessionSettings(session)
}

// MARK: message operations

// list messages
export async function listMessages(sessionId?: string | null): Promise<Message[]> {
  console.debug('chatStore', 'listMessages', sessionId)
  if (!sessionId) {
    return []
  }
  const session = await getSession(sessionId)
  if (!session) {
    return []
  }
  return session.messages
}

export async function insertMessage(sessionId: string, message: Message, previousId?: string) {
  await updateSessionWithMessages(sessionId, (session) => {
    if (!session) {
      throw new Error(`session ${sessionId} not found`)
    }

    if (previousId) {
      // try to find insert position in message list
      let previousIndex = session.messages.findIndex((m) => m.id === previousId)

      if (previousIndex >= 0) {
        return {
          ...session,
          messages: [
            ...session.messages.slice(0, previousIndex + 1),
            message,
            ...session.messages.slice(previousIndex + 1),
          ],
        } satisfies Session
      }

      // try to find insert position in threads
      if (session.threads) {
        for (const thread of session.threads) {
          previousIndex = thread.messages.findIndex((m) => m.id === previousId)
          if (previousIndex >= 0) {
            return {
              ...session,
              threads: session.threads.map((th) => {
                if (th.id === thread.id) {
                  return {
                    ...thread,
                    messages: [
                      ...thread.messages.slice(0, previousIndex + 1),
                      message,
                      ...thread.messages.slice(previousIndex + 1),
                    ],
                  }
                }
                return th
              }),
            } satisfies Session
          }
        }
      }
    }
    // no previous message, insert to tail of current thread
    return {
      ...session,
      messages: [...session.messages, message],
    } satisfies Session
  })
}

export async function updateMessageCache(sessionId: string, messageId: string, updater: Updater<Message>) {
  return await updateMessage(sessionId, messageId, updater, true)
}

export async function updateMessages(sessionId: string, updater: Updater<Message[]>) {
  return await updateSessionWithMessages(sessionId, (session) => {
    if (!session) {
      throw new Error(`session ${sessionId} not found`)
    }
    const updated = compact(typeof updater === 'function' ? updater(session.messages) : updater)
    return {
      ...session,
      messages: updated,
    }
  })
}

export async function updateMessage(
  sessionId: string,
  messageId: string,
  updater: Updater<Message>,
  onlyUpdateCache?: boolean
) {
  const updateFn = onlyUpdateCache ? updateSessionCache : updateSessionWithMessages

  await updateFn(sessionId, (session) => {
    if (!session) {
      throw new Error(`session ${sessionId} not found`)
    }

    const updateMessages = (messages: Message[]) => {
      return messages.map((m) => {
        if (m.id !== messageId) {
          return m
        }
        const updated = typeof updater === 'function' ? updater(m) : updater
        return {
          ...m,
          ...updated,
        } satisfies Message
      })
    }
    const message = session.messages.find((m) => m.id === messageId)
    if (message) {
      return {
        ...session,
        messages: updateMessages(session.messages),
      }
    }

    // try find message in messageForksHash (分支消息)
    if (session.messageForksHash) {
      for (const [forkMsgId, forkData] of Object.entries(session.messageForksHash)) {
        for (let branchIndex = 0; branchIndex < forkData.lists.length; branchIndex++) {
          const branch = forkData.lists[branchIndex]
          const message = branch.messages.find((m) => m.id === messageId)
          if (message) {
            return {
              ...session,
              messageForksHash: {
                ...session.messageForksHash,
                [forkMsgId]: {
                  ...forkData,
                  lists: forkData.lists.map((list, idx) => {
                    if (idx !== branchIndex) {
                      return list
                    }
                    return {
                      ...list,
                      messages: updateMessages(list.messages),
                    }
                  }),
                },
              },
            } satisfies Session
          }
        }
      }
    }

    // try find message in threads
    if (session.threads) {
      for (const thread of session.threads) {
        const message = thread.messages.find((m) => m.id === messageId)
        if (message) {
          return {
            ...session,
            threads: session.threads.map((th) => {
              if (th.id !== thread.id) {
                return th
              }
              return {
                ...th,
                messages: updateMessages(th.messages),
              }
            }),
          } satisfies Session
        }
      }
    }

    return session
  })
}

export async function removeMessage(sessionId: string, messageId: string) {
  return await updateSessionWithMessages(sessionId, (session) => {
    if (!session) {
      throw new Error(`session ${sessionId} not found`)
    }

    // ============ 重构后的删除逻辑 (V5) ============
    // 设计目标：
    // 1. 只删除目标消息及其直接下游（同一分支内）
    // 2. 不影响其他分支的消息
    // 3. 删除后自动切换到下一个有效分支（如果当前分支被清空）

    const idsToDelete = new Set<string>()
    const queue: string[] = [] // 用于广度优先搜索子分支

    /**
     * 核心辅助函数：标记一个消息ID为待删除
     * 同时将其加入队列，以便后续检查它是否有子分支
     */
    const markForDeletion = (id: string) => {
      if (!idsToDelete.has(id)) {
        idsToDelete.add(id)
        queue.push(id)
      }
    }

    // ---------------------------------------------------------
    // 第一步：找到目标消息，并标记它及其"线性下游"（只在同一分支内）
    // ---------------------------------------------------------
    let found = false
    let foundInMainMessages = false
    let foundInBranchForkId: string | null = null
    let foundInBranchIndex: number = -1

    // 1.1 在主消息列表中查找
    const mainMsgIndex = session.messages.findIndex((m) => m.id === messageId)
    if (mainMsgIndex >= 0) {
      // 找到了！标记它和它后面的所有消息（只在主消息列表中）
      for (let i = mainMsgIndex; i < session.messages.length; i++) {
        markForDeletion(session.messages[i].id)
      }
      found = true
      foundInMainMessages = true
    }

    // 1.2 如果主列表没找到，去所有分支列表中查找
    if (!found && session.messageForksHash) {
      // 遍历所有分叉点
      for (const [forkId, forkData] of Object.entries(session.messageForksHash)) {
        // 遍历该分叉点的所有分支
        for (let branchIdx = 0; branchIdx < forkData.lists.length; branchIdx++) {
          const branch = forkData.lists[branchIdx]
          const branchMsgIndex = branch.messages.findIndex((m) => m.id === messageId)
          if (branchMsgIndex >= 0) {
            // 找到了！标记它和它在这个分支上的所有后续消息
            for (let i = branchMsgIndex; i < branch.messages.length; i++) {
              markForDeletion(branch.messages[i].id)
            }
            found = true
            foundInBranchForkId = forkId
            foundInBranchIndex = branchIdx
            break // 找到就跳出当前 forkData
          }
        }
        if (found) break // 找到就结束全局搜索
      }
    }

    // 如果遍历完都没找到，说明消息可能已经被删了，直接返回原 session
    if (!found) {
      return session
    }

    // ---------------------------------------------------------
    // 第二步：递归收集被删除消息的"子分支"（挂在被删消息上的分叉）
    // ---------------------------------------------------------
    // 只删除挂在被删消息上的子分支，不删除兄弟分支
    
    while (queue.length > 0) {
      const currentId = queue.shift()!
      
      // 检查当前待删除的消息是否是某个分叉的根（即它是分叉点）
      if (session.messageForksHash?.[currentId]) {
        const forkData = session.messageForksHash[currentId]
        
        // 遍历该分叉点下的所有分支
        for (const branch of forkData.lists) {
          for (const msg of branch.messages) {
            // 将分支里的所有消息都标记为删除
            // 这会自动把它们加入队列，从而继续递归检查它们的子分支
            markForDeletion(msg.id)
          }
        }
      }
    }

    // ---------------------------------------------------------
    // 第三步：执行物理删除和数据清理
    // ---------------------------------------------------------

    // 过滤主消息列表
    let newMessages = session.messages.filter((m) => !idsToDelete.has(m.id))

    // 3.1 准备新的 messageForksHash
    let newMessageForksHash = session.messageForksHash ? { ...session.messageForksHash } : undefined

    if (newMessageForksHash) {
      // A. 删除无效的 Fork Entry（以被删消息为 key 的分叉）
      for (const id of idsToDelete) {
        if (newMessageForksHash[id]) {
          delete newMessageForksHash[id]
        }
      }

      // B. 清理剩余 Fork Entry 中的消息
      const forkIds = Object.keys(newMessageForksHash)
      for (const forkId of forkIds) {
        const forkData = newMessageForksHash[forkId]
        
        // 过滤掉待删除的消息
        let newLists = forkData.lists.map(branch => ({
          ...branch,
          messages: branch.messages.filter(m => !idsToDelete.has(m.id))
        }))
        
        // 记录新的 position（可能会在分支切换时更新）
        let newPosition = forkData.position

        // 检查当前激活分支是否被清空
        // 注意：激活分支的消息存储在 session.messages 中（分叉点之后的部分）
        // lists[position].messages 通常为空
        
        // 找到分叉点在主消息列表中的位置
        const forkPointIndex = newMessages.findIndex(m => m.id === forkId)
        // 如果分叉点不在主消息列表中，跳过这个分叉的处理
        if (forkPointIndex < 0) {
          // 分叉点可能在 threads 中，这里先跳过
          continue
        }
        
        // 检查激活分支是否还有内容（分叉点之后是否还有消息）
        const activeBranchHasContent = forkPointIndex < newMessages.length - 1
        
        // 如果激活分支被清空，且有其他分支有内容，需要切换到那个分支
        if (!activeBranchHasContent) {
          // 找到第一个有内容的分支（不是当前激活的分支）
          const nextValidBranchIndex = newLists.findIndex((list, idx) => idx !== forkData.position && list.messages.length > 0)
          
          if (nextValidBranchIndex >= 0) {
            // 将该分支的消息提升到主消息列表
            const branchMessages = newLists[nextValidBranchIndex].messages
            newMessages = [...newMessages, ...branchMessages]
            
            // 清空该分支的消息（因为已经提升到主消息列表）
            newLists[nextValidBranchIndex] = {
              ...newLists[nextValidBranchIndex],
              messages: []
            }
            
            // 更新 position 指向新的激活分支
            newPosition = nextValidBranchIndex
          }
        }

        // C. 移除空分支（但保留当前激活的分支，即使它是空的）
        const validLists = newLists.filter((list, idx) => {
          // 保留有消息的分支
          if (list.messages.length > 0) return true
          // 保留当前激活的分支（position 指向的分支）
          if (idx === newPosition) return true
          // 其他空分支移除
          return false
        })

        if (validLists.length === 0) {
          // 如果一个分叉点下的所有分支都空了，那这个分叉点也没意义了
          delete newMessageForksHash[forkId]
        } else if (validLists.length === 1 && validLists[0].messages.length === 0) {
          // 只剩一个空分支，也没意义了
          delete newMessageForksHash[forkId]
        } else {
          // 如果还有有效分支，需要更新 forkData
          // 关键：我们需要确保 position 指针不越界
          
          // 尝试保持新的激活分支（通过 ID 追踪）
          const activeListId = newLists[newPosition]?.id
          let finalPosition = validLists.findIndex(l => l.id === activeListId)
          
          if (finalPosition === -1) {
            // 如果激活分支被删没了，就默认选第一个有内容的
            finalPosition = validLists.findIndex(l => l.messages.length > 0)
            if (finalPosition === -1) finalPosition = 0
          }

          newMessageForksHash[forkId] = {
            ...forkData,
            lists: validLists,
            position: Math.max(0, finalPosition)
          }
        }
      }

      // 如果清理完没有任何 fork 数据了，置为 undefined
      if (Object.keys(newMessageForksHash).length === 0) {
        newMessageForksHash = undefined
      }
    }

    // 3.2 返回更新后的 Session
    return {
      ...session,
      messages: newMessages,
      messageForksHash: newMessageForksHash,
      // 过滤 threads（如果有）
      threads: session.threads?.map((thread) => ({
        ...thread,
        messages: thread.messages.filter((m) => !idsToDelete.has(m.id)),
      })),
    }
  })
}

// MARK: data recovery operations

/**
 * Recover session list by scanning all session: prefixed keys in storage
 * This will clear the current session list and rebuild it from all found sessions
 */
export async function recoverSessionList() {
  console.debug('chatStore', 'recoverSessionList')

  // Get all storage keys
  const allKeys = await storage.getAllKeys()

  // Filter keys that match the session: prefix
  const sessionKeys = allKeys.filter((key) => key.startsWith('session:'))

  // Fetch all sessions with their first message timestamp
  const sessionsWithTimestamp: Array<{ meta: SessionMeta; timestamp: number }> = []
  const failedKeys: string[] = []

  for (const key of sessionKeys) {
    try {
      const session = await storage.getItem<Session | null>(key, null)
      if (session) {
        const migratedSession = migrateSession(session)
        const firstMessageTimestamp = migratedSession.messages[0]?.timestamp || 0
        sessionsWithTimestamp.push({
          meta: getSessionMeta(migratedSession),
          timestamp: firstMessageTimestamp,
        })
      }
    } catch (error) {
      // Handle cases where IndexedDB fails to read large values
      // This can happen with "DataError: Failed to read large IndexedDB value" in some browsers
      console.error(`Failed to read session "${key}":`, error)
      failedKeys.push(key)
    }
  }

  if (failedKeys.length > 0) {
    console.warn(`chatStore: Failed to recover ${failedKeys.length} sessions due to read errors`)
  }

  // Sort by first message timestamp (older first)
  sessionsWithTimestamp.sort((a, b) => a.timestamp - b.timestamp)

  // Extract sorted session metas
  const recoveredSessionMetas = sessionsWithTimestamp.map((item) => item.meta)

  await storage.setItemNow(StorageKey.ChatSessionsList, recoveredSessionMetas)

  // Update the query cache, apply additional sorting rules (pinned sessions, etc.)
  queryClient.setQueryData(QueryKeys.ChatSessionsList, sortSessions(recoveredSessionMetas))

  console.debug(
    'chatStore',
    'recoverSessionList',
    `Recovered ${recoveredSessionMetas.length} sessions, ${failedKeys.length} failed`
  )

  return { recovered: recoveredSessionMetas.length, failed: failedKeys.length }
}

/**
 * 恢复会话消息（用于撤销删除操作）
 * @param sessionId 会话ID
 * @param messages 要恢复的消息列表
 * @param messageForksHash 要恢复的分支哈希
 */
export async function restoreSessionMessages(
  sessionId: string,
  messages: Message[],
  messageForksHash?: Session['messageForksHash']
) {
  return await updateSessionWithMessages(sessionId, (session) => {
    if (!session) {
      throw new Error(`session ${sessionId} not found`)
    }
    
    return {
      ...session,
      messages,
      messageForksHash,
    }
  })
}
